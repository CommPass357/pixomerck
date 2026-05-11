package com.commpass.pixomerck.core

import org.junit.Assert.assertEquals
import org.junit.Test

class ServerEndpointSelectorTest {
    @Test
    fun triesLanBeforeTunnelAndNormalizesTrailingSlash() {
        val endpoints = ServerEndpointSelector.orderedEndpoints(
            ServerEndpointConfig(
                lanBaseUrl = "http://192.168.1.5:8765/",
                tunnelBaseUrl = "https://pixomerck.example.com/"
            )
        )

        assertEquals(
            listOf("http://192.168.1.5:8765", "https://pixomerck.example.com"),
            endpoints
        )
    }

    @Test
    fun dropsBlankAndInvalidEndpoints() {
        val endpoints = ServerEndpointSelector.orderedEndpoints(
            ServerEndpointConfig(
                lanBaseUrl = "192.168.1.5:8765",
                tunnelBaseUrl = ""
            )
        )

        assertEquals(emptyList<String>(), endpoints)
    }
}
