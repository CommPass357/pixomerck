package com.commpass.pixomerck.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PromptValidatorTest {
    @Test
    fun acceptsUsefulPromptAndTrimsWhitespace() {
        val result = PromptValidator.validate("  put me in a red space suit  ")

        assertTrue(result.isValid)
        assertEquals("put me in a red space suit", result.prompt)
    }

    @Test
    fun rejectsTinyPrompt() {
        val result = PromptValidator.validate("hat")

        assertFalse(result.isValid)
    }
}
