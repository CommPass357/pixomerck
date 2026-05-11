package com.commpass.pixomerck

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ElevatedButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.commpass.pixomerck.image.ImageFiles
import com.commpass.pixomerck.ui.theme.PixomerckTheme
import kotlinx.coroutines.launch
import java.io.File

class MainActivity : ComponentActivity() {
    private val viewModel: PixomerckViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            PixomerckTheme {
                PixomerckApp(viewModel)
            }
        }
    }
}

@Composable
private fun PixomerckApp(viewModel: PixomerckViewModel) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var cameraOpen by remember { mutableStateOf(false) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let(viewModel::onGalleryImage)
    }

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    if (cameraOpen) {
        CameraCaptureScreen(
            onClose = { cameraOpen = false },
            onCaptured = {
                cameraOpen = false
                viewModel.onCapturedImage(it)
            }
        )
        return
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Header(state)
            ServerSettings(state, viewModel)
            PromptPanel(state, viewModel)
            ImagePanel(
                imageUri = state.imageUri,
                maskUri = state.maskUri,
                onCapture = { cameraOpen = true },
                onGallery = {
                    picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                }
            )
            GeneratePanel(state, viewModel)
            state.resultUri?.let { resultUri ->
                ResultPanel(
                    resultUri = resultUri,
                    onShare = {
                        scope.launch {
                            val share = Intent(Intent.ACTION_SEND).apply {
                                type = "image/png"
                                putExtra(Intent.EXTRA_STREAM, Uri.parse(resultUri))
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            context.startActivity(Intent.createChooser(share, "Share Pixomerck result"))
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun Header(state: PixomerckUiState) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = "Pixomerck",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = state.activeEndpoint ?: "Local AI photo editor",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(8.dp)
        ) {
            Text(
                text = state.status,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                style = MaterialTheme.typography.labelLarge
            )
        }
    }
}

@Composable
private fun ServerSettings(state: PixomerckUiState, viewModel: PixomerckViewModel) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(8.dp)) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text("Server", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = state.lanBaseUrl,
                onValueChange = { viewModel.updateSettings(it, state.tunnelBaseUrl, state.inviteKey) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("LAN URL") },
                singleLine = true
            )
            OutlinedTextField(
                value = state.tunnelBaseUrl,
                onValueChange = { viewModel.updateSettings(state.lanBaseUrl, it, state.inviteKey) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Tunnel URL") },
                singleLine = true
            )
            OutlinedTextField(
                value = state.inviteKey,
                onValueChange = { viewModel.updateSettings(state.lanBaseUrl, state.tunnelBaseUrl, it) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Invite key") },
                singleLine = true
            )
        }
    }
}

@Composable
private fun PromptPanel(state: PixomerckUiState, viewModel: PixomerckViewModel) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(8.dp)) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Edit", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = state.prompt,
                onValueChange = viewModel::updatePrompt,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Prompt") },
                minLines = 3
            )
            OutlinedTextField(
                value = state.negativePrompt,
                onValueChange = viewModel::updateNegativePrompt,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Negative prompt") },
                minLines = 2
            )
            Text("Strength ${(state.strength * 100).toInt()}%", style = MaterialTheme.typography.labelLarge)
            Slider(
                value = state.strength,
                onValueChange = viewModel::updateStrength,
                valueRange = 0.15f..0.95f
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = state.size == 512,
                    onClick = { viewModel.updateSize(512) },
                    label = { Text("512") }
                )
                FilterChip(
                    selected = state.size == 768,
                    onClick = { viewModel.updateSize(768) },
                    label = { Text("768") }
                )
            }
        }
    }
}

@Composable
private fun ImagePanel(
    imageUri: String?,
    maskUri: String?,
    onCapture: () -> Unit,
    onGallery: () -> Unit
) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(8.dp)) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Photo", style = MaterialTheme.typography.titleMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ElevatedButton(onClick = onCapture) { Text("Camera") }
                    ElevatedButton(onClick = onGallery) { Text("Gallery") }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PreviewSlot("Source", imageUri, Modifier.weight(1f))
                PreviewSlot("Mask", maskUri, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun GeneratePanel(state: PixomerckUiState, viewModel: PixomerckViewModel) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(8.dp)) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = viewModel::generate,
                enabled = !state.isBusy,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (state.isBusy) "Generating" else "Generate")
            }
            if (state.isBusy || state.progress > 0f) {
                LinearProgressIndicator(
                    progress = { state.progress.coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun ResultPanel(resultUri: String, onShare: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(8.dp)) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Result", style = MaterialTheme.typography.titleMedium)
                TextButton(onClick = onShare) { Text("Share") }
            }
            PreviewSlot("Generated", resultUri, Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun PreviewSlot(label: String, uri: String?, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium)
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .height(210.dp),
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(8.dp)
        ) {
            if (uri == null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Empty", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LocalBitmapImage(uri)
            }
        }
    }
}

@Composable
private fun LocalBitmapImage(uri: String) {
    val context = LocalContext.current
    val bitmap = remember(uri) {
        runCatching {
            ImageFiles.decodeUri(context, Uri.parse(uri), maxDimension = 1400).asImageBitmap()
        }.getOrNull()
    }
    if (bitmap == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Preview unavailable", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    } else {
        Image(
            bitmap = bitmap,
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Fit
        )
    }
}

@Composable
private fun CameraCaptureScreen(
    onClose: () -> Unit,
    onCaptured: (File) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var permissionGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { permissionGranted = it }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }

    LaunchedEffect(Unit) {
        if (!permissionGranted) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (permissionGranted) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { viewContext ->
                    val previewView = PreviewView(viewContext)
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(viewContext)
                    cameraProviderFuture.addListener(
                        {
                            val cameraProvider = cameraProviderFuture.get()
                            val preview = Preview.Builder().build().also {
                                it.setSurfaceProvider(previewView.surfaceProvider)
                            }
                            val capture = ImageCapture.Builder()
                                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                                .build()
                            cameraProvider.unbindAll()
                            cameraProvider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                capture
                            )
                            imageCapture = capture
                        },
                        ContextCompat.getMainExecutor(viewContext)
                    )
                    previewView
                }
            )
            DisposableEffect(Unit) {
                onDispose {
                    ProcessCameraProvider.getInstance(context).get().unbindAll()
                }
            }
        } else {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Camera permission needed")
            }
        }

        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(18.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onClose) { Text("Close") }
            Button(
                onClick = {
                    val outputFile = ImageFiles.createCameraFile(context)
                    val options = ImageCapture.OutputFileOptions.Builder(outputFile).build()
                    imageCapture?.takePicture(
                        options,
                        ContextCompat.getMainExecutor(context),
                        object : ImageCapture.OnImageSavedCallback {
                            override fun onError(exception: ImageCaptureException) = Unit
                            override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                                onCaptured(outputFile)
                            }
                        }
                    )
                },
                enabled = imageCapture != null && permissionGranted
            ) {
                Text("Take Photo")
            }
            Spacer(modifier = Modifier.width(64.dp))
        }
    }
}
