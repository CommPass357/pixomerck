package com.commpass.pixomerck.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.pixomerckDataStore by preferencesDataStore("pixomerck_settings")

class SettingsRepository(context: Context) {
    private val dataStore = context.applicationContext.pixomerckDataStore

    val settings: Flow<AppSettings> = dataStore.data.map { prefs ->
        AppSettings(
            lanBaseUrl = prefs[LAN_URL] ?: AppSettings().lanBaseUrl,
            tunnelBaseUrl = prefs[TUNNEL_URL] ?: "",
            inviteKey = prefs[INVITE_KEY] ?: ""
        )
    }

    suspend fun save(settings: AppSettings) {
        dataStore.edit { prefs ->
            prefs[LAN_URL] = settings.lanBaseUrl
            prefs[TUNNEL_URL] = settings.tunnelBaseUrl
            prefs[INVITE_KEY] = settings.inviteKey
        }
    }

    private companion object {
        val LAN_URL = stringPreferencesKey("lan_url")
        val TUNNEL_URL = stringPreferencesKey("tunnel_url")
        val INVITE_KEY = stringPreferencesKey("invite_key")
    }
}
