package com.commpass.pixomerck.core

import org.junit.Assert.assertEquals
import org.junit.Test

class PollingPolicyTest {
    @Test
    fun backsOffAfterEarlyPolls() {
        assertEquals(1_000L, PollingPolicy.delayForAttempt(0))
        assertEquals(2_000L, PollingPolicy.delayForAttempt(4))
        assertEquals(3_500L, PollingPolicy.delayForAttempt(20))
    }
}
