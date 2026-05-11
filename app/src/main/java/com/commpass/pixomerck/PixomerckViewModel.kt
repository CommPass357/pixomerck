package com.commpass.pixomerck

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.commpass.pixomerck.core.PollingPolicy
import com.commpass.pixomerck.core.PromptValidator
import com.commpass.pixomerck.core.ServerEndpointConfig
import com.commpass.pixomerck.core.ServerEndpointSelector
import com.commpass.pixomerck.data.AppSettings
import com.commpass.pixomerck.data.SettingsRepository
import com.commpass.pixomerck.image.ImageFiles
import com.commpass.pixomerck.image.PersonMaskGenerator
import com.commpass.pixomerck.network.CreateJobRequest
import com.commpass.pixomerck.network.PixomerckApiClient
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File

data class PixomerckUiState(
    val prompt: String = "",
    val negativePrompt: String = "blurred face, distorted hands, low quality, extra fingers",
    val lanBaseUrl: String = AppSettings().lanBaseUrl,
    val tunnelBaseUrl: String = "",
    val inviteKey: String = "",
    val imageUri: String? = null,
    val maskUri: String? = null,
    val resultUri: String? = null,
    val status: String = "Idle",
    val error: String? = null,
    val progress: Float = 0f,
    val isBusy: Boolean = false,
    val strength: Float = 0.62f,
    val size: Int = 512,
    val activeEndpoint: String? = null
)

class PixomerckViewModel(
    application: Application,
    private val settingsRepository: SettingsRepository = SettingsRepository(application),
    private val apiClient: PixomerckApiClient = PixomerckApiClient()
) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(PixomerckUiState())
    val state: StateFlow<PixomerckUiState> = _state.asStateFlow()

    private var selectedImageFile: File? = null
    private var selectedMaskFile: File? = null
    private var generationJob: Job? = null

    init {
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                _state.update {
                    it.copy(
                        lanBaseUrl = settings.lanBaseUrl,
                        tunnelBaseUrl = settings.tunnelBaseUrl,
                        inviteKey = settings.inviteKey
                    )
                }
            }
        }
    }

    fun updatePrompt(value: String) = _state.update { it.copy(prompt = value, error = null) }
    fun updateNegativePrompt(value: String) = _state.update { it.copy(negativePrompt = value) }
    fun updateStrength(value: Float) = _state.update { it.copy(strength = value.coerceIn(0.15f, 0.95f)) }
    fun updateSize(value: Int) = _state.update { it.copy(size = value) }

    fun updateSettings(lanBaseUrl: String, tunnelBaseUrl: String, inviteKey: String) {
        _state.update {
            it.copy(
                lanBaseUrl = lanBaseUrl,
                tunnelBaseUrl = tunnelBaseUrl,
                inviteKey = inviteKey,
                error = null
            )
        }
        viewModelScope.launch {
            settingsRepository.save(
                AppSettings(
                    lanBaseUrl = lanBaseUrl,
                    tunnelBaseUrl = tunnelBaseUrl,
                    inviteKey = inviteKey
                )
            )
        }
    }

    fun onGalleryImage(uri: Uri) {
        viewModelScope.launch {
            runCatching {
                val file = ImageFiles.copyUriToCache(getApplication(), uri, "source", "image")
                setImageFile(file)
            }.onFailure { error ->
                _state.update { it.copy(error = error.message ?: "Unable to read selected image.") }
            }
        }
    }

    fun onCapturedImage(file: File) {
        viewModelScope.launch {
            runCatching { setImageFile(file) }
                .onFailure { error ->
                    _state.update { it.copy(error = error.message ?: "Unable to load captured image.") }
                }
        }
    }

    fun generate() {
        if (generationJob?.isActive == true) return
        generationJob = viewModelScope.launch {
            val snapshot = state.value
            val validation = PromptValidator.validate(snapshot.prompt)
            if (!validation.isValid) {
                _state.update { it.copy(error = validation.error, status = "Prompt needed") }
                return@launch
            }
            val imageFile = selectedImageFile
            val maskFile = selectedMaskFile
            if (imageFile == null || maskFile == null) {
                _state.update { it.copy(error = "Capture or select a photo first.", status = "Photo needed") }
                return@launch
            }
            val endpoints = ServerEndpointSelector.orderedEndpoints(
                ServerEndpointConfig(snapshot.lanBaseUrl, snapshot.tunnelBaseUrl)
            )
            if (endpoints.isEmpty()) {
                _state.update { it.copy(error = "Add a LAN or tunnel server URL.", status = "Server needed") }
                return@launch
            }
            if (snapshot.inviteKey.isBlank()) {
                _state.update { it.copy(error = "Enter the server invite key.", status = "Pairing needed") }
                return@launch
            }

            _state.update {
                it.copy(
                    isBusy = true,
                    error = null,
                    progress = 0f,
                    resultUri = null,
                    status = "Submitting"
                )
            }

            var lastError: Throwable? = null
            for (endpoint in endpoints) {
                runCatching {
                    _state.update { it.copy(activeEndpoint = endpoint, status = "Checking server") }
                    apiClient.health(endpoint, snapshot.inviteKey)
                    val jobId = apiClient.createJob(
                        baseUrl = endpoint,
                        inviteKey = snapshot.inviteKey,
                        imageFile = imageFile,
                        maskFile = maskFile,
                        createJobRequest = CreateJobRequest(
                            prompt = validation.prompt,
                            negativePrompt = snapshot.negativePrompt.trim(),
                            seed = null,
                            strength = snapshot.strength,
                            size = snapshot.size
                        )
                    )
                    pollUntilDone(endpoint, snapshot.inviteKey, jobId)
                    return@launch
                }.onFailure { lastError = it }
            }

            _state.update {
                it.copy(
                    isBusy = false,
                    status = "Failed",
                    error = lastError?.message ?: "All configured servers failed."
                )
            }
        }
    }

    fun clearError() {
        _state.update { it.copy(error = null) }
    }

    private suspend fun setImageFile(file: File) {
        selectedImageFile = file
        val sourceUri = ImageFiles.uriForFile(getApplication(), file)
        val bitmap = ImageFiles.decodeUri(getApplication(), sourceUri)
        val mask = PersonMaskGenerator(getApplication()).use { it.createMask(bitmap) }
        val maskFile = File(getApplication<Application>().cacheDir, "masks/person-mask.png")
        selectedMaskFile = ImageFiles.writePng(mask, maskFile)
        _state.update {
            it.copy(
                imageUri = sourceUri.toString(),
                maskUri = ImageFiles.uriForFile(getApplication(), maskFile).toString(),
                resultUri = null,
                progress = 0f,
                status = "Photo ready",
                error = null
            )
        }
    }

    private suspend fun pollUntilDone(baseUrl: String, inviteKey: String, jobId: String) {
        var attempt = 0
        while (true) {
            val job = apiClient.getJob(baseUrl, inviteKey, jobId)
            _state.update {
                it.copy(
                    status = job.status.replaceFirstChar { char -> char.titlecase() },
                    progress = job.progress.coerceIn(0f, 1f)
                )
            }
            if (job.status == "completed") {
                val resultFile = File(getApplication<Application>().cacheDir, "results/$jobId.png")
                apiClient.downloadImage(baseUrl, inviteKey, jobId, resultFile)
                _state.update {
                    it.copy(
                        isBusy = false,
                        status = "Completed",
                        progress = 1f,
                        resultUri = ImageFiles.uriForFile(getApplication(), resultFile).toString()
                    )
                }
                return
            }
            if (job.status == "failed") {
                _state.update {
                    it.copy(
                        isBusy = false,
                        status = "Failed",
                        error = job.error ?: "Generation failed."
                    )
                }
                return
            }
            delay(PollingPolicy.delayForAttempt(attempt++))
        }
    }
}
