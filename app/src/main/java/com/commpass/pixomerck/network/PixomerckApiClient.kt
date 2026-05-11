package com.commpass.pixomerck.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

class PixomerckApiClient(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()
) {
    suspend fun health(baseUrl: String, inviteKey: String): HealthStatus = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl/health")
            .withInviteKey(inviteKey)
            .get()
            .build()
        client.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException("Health check failed: HTTP ${response.code}")
            }
            val json = JSONObject(body)
            HealthStatus(
                ok = json.optBoolean("ok"),
                backendReady = json.optBoolean("backend_ready"),
                gpu = json.optStringOrNull("gpu"),
                message = json.optStringOrNull("message")
            )
        }
    }

    suspend fun createJob(
        baseUrl: String,
        inviteKey: String,
        imageFile: File,
        maskFile: File,
        createJobRequest: CreateJobRequest
    ): String = withContext(Dispatchers.IO) {
        val request = buildCreateJobRequest(baseUrl, inviteKey, imageFile, maskFile, createJobRequest)
        client.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException(extractError(body, "Create job failed: HTTP ${response.code}"))
            }
            JSONObject(body).getString("id")
        }
    }

    suspend fun getJob(baseUrl: String, inviteKey: String, jobId: String): JobStatus =
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url("$baseUrl/v1/jobs/$jobId")
                .withInviteKey(inviteKey)
                .get()
                .build()
            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw IOException(extractError(body, "Job status failed: HTTP ${response.code}"))
                }
                val json = JSONObject(body)
                JobStatus(
                    id = json.getString("id"),
                    status = json.getString("status"),
                    progress = json.optDouble("progress", 0.0).toFloat(),
                    error = json.optStringOrNull("error"),
                    resultPath = json.optStringOrNull("result_path")
                )
            }
        }

    suspend fun downloadImage(
        baseUrl: String,
        inviteKey: String,
        jobId: String,
        destination: File
    ): File = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl/v1/jobs/$jobId/image")
            .withInviteKey(inviteKey)
            .get()
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Result download failed: HTTP ${response.code}")
            }
            val body = response.body ?: throw IOException("Result download had no body")
            destination.parentFile?.mkdirs()
            destination.outputStream().use { output -> body.byteStream().copyTo(output) }
            destination
        }
    }

    fun buildCreateJobRequest(
        baseUrl: String,
        inviteKey: String,
        imageFile: File,
        maskFile: File,
        createJobRequest: CreateJobRequest
    ): Request {
        val imageType = "image/jpeg".toMediaType()
        val maskType = "image/png".toMediaType()
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart(
                "image",
                imageFile.name,
                imageFile.asRequestBody(imageType)
            )
            .addFormDataPart(
                "person_mask",
                maskFile.name,
                maskFile.asRequestBody(maskType)
            )
            .addFormDataPart("prompt", createJobRequest.prompt)
            .addFormDataPart("negative_prompt", createJobRequest.negativePrompt)
            .addFormDataPart("strength", createJobRequest.strength.toString())
            .addFormDataPart("size", createJobRequest.size.toString())
            .apply {
                createJobRequest.seed?.let { addFormDataPart("seed", it.toString()) }
            }
            .build()

        return Request.Builder()
            .url("$baseUrl/v1/jobs")
            .withInviteKey(inviteKey)
            .post(body)
            .build()
    }

    private fun Request.Builder.withInviteKey(inviteKey: String): Request.Builder {
        if (inviteKey.isNotBlank()) {
            header("X-Pixomerck-Key", inviteKey.trim())
        }
        return this
    }

    private fun JSONObject.optStringOrNull(name: String): String? {
        val value = optString(name, "")
        return value.ifBlank { null }
    }

    private fun extractError(body: String, fallback: String): String {
        return runCatching {
            JSONObject(body).optString("detail", fallback)
        }.getOrElse { fallback }
    }
}
