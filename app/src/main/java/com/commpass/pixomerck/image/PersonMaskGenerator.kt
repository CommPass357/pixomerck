package com.commpass.pixomerck.image

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.ByteBufferExtractor
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.imagesegmenter.ImageSegmenter
import java.io.Closeable
import java.io.File
import java.nio.ByteOrder

class PersonMaskGenerator(private val context: Context) : Closeable {
    fun createMask(source: Bitmap): Bitmap {
        return runCatching { createMediaPipeMask(source) }
            .getOrNull()
            ?: createFallbackMask(source.width, source.height)
    }

    override fun close() = Unit

    private fun createMediaPipeMask(source: Bitmap): Bitmap? {
        if (!hasModelAsset()) return null
        val options = ImageSegmenter.ImageSegmenterOptions.builder()
            .setBaseOptions(
                BaseOptions.builder()
                    .setModelAssetPath(MODEL_ASSET)
                    .build()
            )
            .setRunningMode(RunningMode.IMAGE)
            .setOutputCategoryMask(false)
            .setOutputConfidenceMasks(true)
            .build()

        ImageSegmenter.createFromOptions(context, options).use { segmenter ->
            val result = segmenter.segment(BitmapImageBuilder(source).build())
            val confidenceMasks = result.confidenceMasks()
            if (!confidenceMasks.isPresent || confidenceMasks.get().size < 2) return null

            val personMask = confidenceMasks.get()[1]
            val buffer = ByteBufferExtractor.extract(personMask).order(ByteOrder.nativeOrder())
            val mask = Bitmap.createBitmap(personMask.width, personMask.height, Bitmap.Config.ARGB_8888)
            val pixels = IntArray(personMask.width * personMask.height)
            for (i in pixels.indices) {
                val confidence = buffer.getFloat(i * 4).coerceIn(0f, 1f)
                val alpha = (confidence * 255).toInt()
                pixels[i] = Color.argb(alpha, 255, 255, 255)
            }
            mask.setPixels(pixels, 0, personMask.width, 0, 0, personMask.width, personMask.height)
            return if (mask.width == source.width && mask.height == source.height) {
                mask
            } else {
                Bitmap.createScaledBitmap(mask, source.width, source.height, true)
            }
        }
    }

    private fun hasModelAsset(): Boolean {
        return runCatching {
            context.assets.open(MODEL_ASSET).use { it.read() }
        }.isSuccess
    }

    private fun createFallbackMask(width: Int, height: Int): Bitmap {
        val mask = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(mask)
        canvas.drawColor(Color.TRANSPARENT)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            style = Paint.Style.FILL
        }

        val head = RectF(width * 0.34f, height * 0.12f, width * 0.66f, height * 0.42f)
        canvas.drawOval(head, paint)

        val body = Path().apply {
            moveTo(width * 0.22f, height * 0.95f)
            cubicTo(width * 0.25f, height * 0.50f, width * 0.38f, height * 0.36f, width * 0.50f, height * 0.36f)
            cubicTo(width * 0.62f, height * 0.36f, width * 0.75f, height * 0.50f, width * 0.78f, height * 0.95f)
            close()
        }
        canvas.drawPath(body, paint)
        return mask
    }

    private companion object {
        const val MODEL_ASSET = "selfie_segmenter.tflite"
    }
}
