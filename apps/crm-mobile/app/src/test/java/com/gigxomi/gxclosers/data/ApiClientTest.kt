package com.gigxomi.gxclosers.data

import org.junit.Assert.assertEquals
import org.junit.Test

class ApiClientTest {
    @Test fun productionEndpointIsBuiltWithoutDuplicateSlashes() {
        assertEquals("https://closers.gigxomi.com/api/sales/mobile/bootstrap", ApiClient.endpoint("/sales/mobile/bootstrap"))
    }
}
