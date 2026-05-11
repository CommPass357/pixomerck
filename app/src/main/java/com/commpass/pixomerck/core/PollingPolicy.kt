package com.commpass.pixomerck.core

object PollingPolicy {
    fun delayForAttempt(attempt: Int): Long {
        return when {
            attempt <= 2 -> 1_000L
            attempt <= 8 -> 2_000L
            else -> 3_500L
        }
    }
}
