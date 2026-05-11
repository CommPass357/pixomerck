package com.commpass.pixomerck.core

data class ServerEndpointConfig(
    val lanBaseUrl: String,
    val tunnelBaseUrl: String
)

object ServerEndpointSelector {
    fun orderedEndpoints(config: ServerEndpointConfig): List<String> {
        return listOf(config.lanBaseUrl, config.tunnelBaseUrl)
            .mapNotNull { normalize(it) }
            .distinct()
    }

    fun normalize(input: String): String? {
        val value = input.trim().trimEnd('/')
        if (value.isBlank()) return null
        if (!value.startsWith("http://") && !value.startsWith("https://")) return null
        return value
    }
}
