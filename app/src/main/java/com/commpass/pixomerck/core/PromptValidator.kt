package com.commpass.pixomerck.core

data class PromptValidation(
    val prompt: String,
    val isValid: Boolean,
    val error: String? = null
)

object PromptValidator {
    private const val MIN_LENGTH = 8
    private const val MAX_LENGTH = 800

    fun validate(input: String): PromptValidation {
        val prompt = input.trim()
        return when {
            prompt.length < MIN_LENGTH -> PromptValidation(
                prompt = prompt,
                isValid = false,
                error = "Describe the edit in at least $MIN_LENGTH characters."
            )

            prompt.length > MAX_LENGTH -> PromptValidation(
                prompt = prompt,
                isValid = false,
                error = "Keep the prompt under $MAX_LENGTH characters."
            )

            else -> PromptValidation(prompt = prompt, isValid = true)
        }
    }
}
