package com.commpass.pixomerck.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Colors = darkColorScheme(
    primary = Color(0xFF34C6A3),
    onPrimary = Color(0xFF05231C),
    secondary = Color(0xFFFFC857),
    onSecondary = Color(0xFF261C00),
    background = Color(0xFF101417),
    surface = Color(0xFF171D21),
    surfaceVariant = Color(0xFF243038),
    onBackground = Color(0xFFF3F7F5),
    onSurface = Color(0xFFF3F7F5),
    onSurfaceVariant = Color(0xFFC8D2D0),
    error = Color(0xFFFF8A80)
)

@Composable
fun PixomerckTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = Colors,
        content = content
    )
}
