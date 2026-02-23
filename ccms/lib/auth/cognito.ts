export type CognitoTokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
};

type RuntimeCognitoConfig = {
  region: string;
  clientId: string;
};

type CognitoAuthenticationResult = {
  IdToken?: string;
  AccessToken?: string;
  RefreshToken?: string;
};

function getCognitoConfig(): RuntimeCognitoConfig {
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

  if (!region || !clientId) {
    throw new Error(
      "Missing Cognito config. Set NEXT_PUBLIC_COGNITO_REGION and NEXT_PUBLIC_COGNITO_CLIENT_ID."
    );
  }

  return { region, clientId };
}

function getCognitoEndpoint(region: string): string {
  return `https://cognito-idp.${region}.amazonaws.com/`;
}

async function callCognito<TResponse>(
  target: string,
  payload: Record<string, unknown>
): Promise<TResponse> {
  const { region } = getCognitoConfig();
  const response = await fetch(getCognitoEndpoint(region), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": target,
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

  if (!response.ok) {
    const message =
      (parsed.message as string | undefined) ??
      (parsed.__type as string | undefined) ??
      `Cognito request failed (${response.status})`;
    throw new Error(message);
  }

  return parsed as TResponse;
}

async function initiateAuthViaHttp(
  username: string,
  password: string
): Promise<CognitoTokens> {
  const { clientId } = getCognitoConfig();
  const response = await callCognito<{
    AuthenticationResult?: CognitoAuthenticationResult;
  }>("AWSCognitoIdentityProviderService.InitiateAuth", {
    ClientId: clientId,
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  });

  const result = response.AuthenticationResult;
  if (!result?.IdToken || !result.AccessToken || !result.RefreshToken) {
    throw new Error("Cognito did not return a complete token set.");
  }

  return {
    idToken: result.IdToken,
    accessToken: result.AccessToken,
    refreshToken: result.RefreshToken,
  };
}

async function initiateAuthViaSdk(
  username: string,
  password: string
): Promise<CognitoTokens> {
  const importer = new Function("moduleName", "return import(moduleName)") as (
    moduleName: string
  ) => Promise<Record<string, unknown>>;

  try {
    const sdk = await importer("@aws-sdk/client-cognito-identity-provider");

    const CognitoIdentityProviderClient = sdk[
      "CognitoIdentityProviderClient"
    ] as new (input: { region: string }) => {
      send(command: unknown): Promise<{ AuthenticationResult?: CognitoAuthenticationResult }>;
    };

    const InitiateAuthCommand = sdk["InitiateAuthCommand"] as new (input: {
      ClientId: string;
      AuthFlow: string;
      AuthParameters: { USERNAME: string; PASSWORD: string };
    }) => unknown;

    if (!CognitoIdentityProviderClient || !InitiateAuthCommand) {
      return initiateAuthViaHttp(username, password);
    }

    const { region, clientId } = getCognitoConfig();
    const client = new CognitoIdentityProviderClient({ region });

    const response = await client.send(
      new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      })
    );

    const result = response.AuthenticationResult;
    if (!result?.IdToken || !result.AccessToken || !result.RefreshToken) {
      throw new Error("Cognito did not return a complete token set.");
    }

    return {
      idToken: result.IdToken,
      accessToken: result.AccessToken,
      refreshToken: result.RefreshToken,
    };
  } catch {
    return initiateAuthViaHttp(username, password);
  }
}

export async function authenticateOperator(
  username: string,
  password: string
): Promise<CognitoTokens> {
  if (!username || !password) {
    throw new Error("Username and password are required.");
  }

  return initiateAuthViaSdk(username.trim(), password);
}

export async function requestPasswordReset(username: string): Promise<void> {
  if (!username) {
    throw new Error("Username is required for password reset.");
  }

  const { clientId } = getCognitoConfig();
  await callCognito(
    "AWSCognitoIdentityProviderService.ForgotPassword",
    {
      ClientId: clientId,
      Username: username.trim(),
    }
  );
}
