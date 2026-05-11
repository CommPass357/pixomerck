package com.commpass.pixomerck.network

data class CreateJobRequest(
    val prompt: String,
    val negativePrompt: String,
    val seed: Long?,
    val strength: Float,
    val size: Int
)

data class JobStatus(
    val id: String,
    val status: String,
    val progress: Float,
    val error: String?,
    val resultPath: String?
) {
    val isTerminal: Boolean
        get() = status == "completed" || status == "failed"
}

data class HealthStatus(
    val ok: Boolean,
    val backendReady: Boolean,
    val gpu: String?,
    val message: String?
)
