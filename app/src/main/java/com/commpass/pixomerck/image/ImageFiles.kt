package com.commpass.pixomerck.image

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File
import java.time.Instant

object ImageFiles {
    fun createCameraFile(context: Context): File {
        val dir = File(context.cacheDir, "camera").also { it.mkdirs() }
        return File(dir, "pixomerck-${Instant.now().toEpochMilli()}.jpg")
    }

    fun uriForFile(context: Context, file: File): Uri {
        return FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
    }

    fun copyUriToCache(context: Context, uri: Uri, prefix: String, extension: String): File {
        val dir = File(context.cacheDir, "uploads").also { it.mkdirs() }
        val file = File(dir, "$prefix-${Instant.now().toEpochMilli()}.$extension")
        context.contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Unable to open selected image." }
            file.outputStream().use { output -> input.copyTo(output) }
        }
        return file
    }

    fun decodeUri(context: Context, uri: Uri, maxDimension: Int = 1280): Bitmap {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri).use { input ->
            BitmapFactory.decodeStream(input, null, options)
        }
        options.inSampleSize = sampleSize(options.outWidth, options.outHeight, maxDimension)
        options.inJustDecodeBounds = false
        return context.contentResolver.openInputStream(uri).use { input ->
            requireNotNull(BitmapFactory.decodeStream(input, null, options)) {
                "Unable to decode image."
            }
        }
    }

    fun writePng(bitmap: Bitmap, destination: File): File {
        destination.parentFile?.mkdirs()
        destination.outputStream().use { output ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        }
        return destination
    }

    private fun sampleSize(width: Int, height: Int, maxDimension: Int): Int {
        var sample = 1
        var scaledWidth = width
        var scaledHeight = height
        while (scaledWidth / 2 >= maxDimension || scaledHeight / 2 >= maxDimension) {
            sample *= 2
            scaledWidth /= 2
            scaledHeight /= 2
        }
        return sample.coerceAtLeast(1)
    }
}
