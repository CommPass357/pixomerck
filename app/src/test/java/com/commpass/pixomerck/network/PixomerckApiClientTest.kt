package com.commpass.pixomerck.network

import okhttp3.MultipartBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class PixomerckApiClientTest {
    @Test
    fun createJobRequestUsesAuthHeaderAndMultipartBody() {
        val tempDir = createTempDir()
        val image = File(tempDir, "image.jpg").apply { writeBytes(byteArrayOf(1, 2, 3)) }
        val mask = File(tempDir, "mask.png").apply { writeBytes(byteArrayOf(4, 5, 6)) }

        val request = PixomerckApiClient().buildCreateJobRequest(
            baseUrl = "http://127.0.0.1:8765",
            inviteKey = "secret-key",
            imageFile = image,
            maskFile = mask,
            createJobRequest = CreateJobRequest(
                prompt = "make the jacket neon",
                negativePrompt = "low quality",
                seed = 42,
                strength = 0.7f,
                size = 512
            )
        )

        assertEquals("secret-key", request.header("X-Pixomerck-Key"))
        assertEquals("http://127.0.0.1:8765/v1/jobs", request.url.toString())
        assertTrue(request.body is MultipartBody)
    }
}
