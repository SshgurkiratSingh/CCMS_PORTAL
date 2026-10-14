package com.wedoccms.myapplication.data.remote

import com.wedoccms.myapplication.data.model.ApiResponse
import com.wedoccms.myapplication.data.model.PanelMetadata
import com.wedoccms.myapplication.data.model.PatchRelayPayload
import com.wedoccms.myapplication.data.model.PatchSchedulePayload
import com.wedoccms.myapplication.data.model.PatchShadowKeysPayload
import com.wedoccms.myapplication.data.model.SnapshotItem
import com.wedoccms.myapplication.data.model.TelemetryLog
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Query

interface CcmsApiService {

    @GET("DashboardAPIHandler")
    suspend fun getSnapshot(
        @Query("enquiry") enquiry: String = "snapshot"
    ): Response<List<SnapshotItem>>

    @GET("DashboardAPIHandler")
    suspend fun getTelemetryHistory(
        @Query("enquiry") enquiry: String = "history",
        @Query("panel_id") panelId: String,
        @Query("start") start: String,
        @Query("end") end: String
    ): Response<List<TelemetryLog>>

    @GET("DashboardAPIHandler")
    suspend fun getPanelMetadata(
        @Query("panel_id") panelId: String
    ): Response<PanelMetadata>

    @POST("DashboardAPIHandler")
    suspend fun registerPanel(
        @Body metadata: PanelMetadata
    ): Response<ApiResponse>

    @PUT("DashboardAPIHandler")
    suspend fun updatePanel(
        @Body metadata: PanelMetadata
    ): Response<ApiResponse>

    @PATCH("DashboardAPIHandler")
    suspend fun patchRelayState(
        @Body payload: PatchRelayPayload
    ): Response<ApiResponse>

    @PATCH("DashboardAPIHandler")
    suspend fun patchSchedule(
        @Body payload: PatchSchedulePayload
    ): Response<ApiResponse>

    @PATCH("DashboardAPIHandler")
    suspend fun patchShadowKeys(
        @Body payload: PatchShadowKeysPayload
    ): Response<ApiResponse>

    @DELETE("DashboardAPIHandler")
    suspend fun deletePanel(
        @Query("panel_id") panelId: String
    ): Response<ApiResponse>
}
