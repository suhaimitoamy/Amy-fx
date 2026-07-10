package com.amyelitesuite

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.io.File

class CandleStore(private val context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    data class Candle(
        val symbol: String,
        val timeframe: String,
        val openTime: Long,
        val closeTime: Long,
        val open: Double,
        val high: Double,
        val low: Double,
        val close: Double,
        val volumeTick: Long,
        val isClosed: Boolean
    )

    override fun onCreate(db: SQLiteDatabase) {
        createTables(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        createTables(db)
    }

    private fun createTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS candles (
                symbol TEXT NOT NULL,
                timeframe TEXT NOT NULL,
                open_time INTEGER NOT NULL,
                close_time INTEGER NOT NULL,
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,
                volume_tick INTEGER NOT NULL DEFAULT 0,
                is_closed INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY(symbol, timeframe, open_time)
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_candles_symbol_tf_time ON candles(symbol, timeframe, open_time)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_candles_timeframe_time ON candles(timeframe, open_time)")
    }

    fun upsert(candle: Candle) {
        val values = candle.toValues()
        writableDatabase.insertWithOnConflict("candles", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun upsertAll(candles: List<Candle>) {
        if (candles.isEmpty()) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            candles.forEach { candle ->
                db.insertWithOnConflict("candles", null, candle.toValues(), SQLiteDatabase.CONFLICT_REPLACE)
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
        cleanupExpiredCandles()
    }

    fun getLatest(symbol: String, timeframe: String, limit: Int): List<Candle> {
        val out = mutableListOf<Candle>()
        readableDatabase.rawQuery(
            """
            SELECT symbol, timeframe, open_time, close_time, open, high, low, close, volume_tick, is_closed
            FROM candles
            WHERE symbol = ? AND timeframe = ?
            ORDER BY open_time DESC
            LIMIT ?
            """.trimIndent(),
            arrayOf(symbol, timeframe, limit.coerceIn(1, 5000).toString())
        ).use { cursor ->
            while (cursor.moveToNext()) {
                out.add(
                    Candle(
                        symbol = cursor.getString(0),
                        timeframe = cursor.getString(1),
                        openTime = cursor.getLong(2),
                        closeTime = cursor.getLong(3),
                        open = cursor.getDouble(4),
                        high = cursor.getDouble(5),
                        low = cursor.getDouble(6),
                        close = cursor.getDouble(7),
                        volumeTick = cursor.getLong(8),
                        isClosed = cursor.getInt(9) == 1
                    )
                )
            }
        }
        return out.reversed()
    }

    fun getLastOpenTime(symbol: String, timeframe: String): Long? {
        readableDatabase.rawQuery(
            """
            SELECT open_time FROM candles
            WHERE symbol = ? AND timeframe = ?
            ORDER BY open_time DESC
            LIMIT 1
            """.trimIndent(),
            arrayOf(symbol, timeframe)
        ).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getLong(0) else null
        }
    }

    fun trim(symbol: String, timeframe: String, keepLatest: Int) {
        writableDatabase.execSQL(
            """
            DELETE FROM candles
            WHERE symbol = ? AND timeframe = ? AND open_time NOT IN (
                SELECT open_time FROM candles
                WHERE symbol = ? AND timeframe = ?
                ORDER BY open_time DESC
                LIMIT ?
            )
            """.trimIndent(),
            arrayOf(symbol, timeframe, symbol, timeframe, keepLatest.coerceAtLeast(100))
        )
    }

    fun cleanupExpiredCandles(nowSeconds: Long = System.currentTimeMillis() / 1000L) {
        val db = writableDatabase
        val day = 24L * 60L * 60L
        val shortTfCutoff = nowSeconds - (90L * day)
        val longTfCutoff = nowSeconds - (365L * day)
        db.delete("candles", "timeframe IN (?, ?, ?, ?) AND open_time < ?", arrayOf("M1", "M5", "M15", "M30", shortTfCutoff.toString()))
        db.delete("candles", "timeframe IN (?, ?, ?) AND open_time < ?", arrayOf("H1", "H4", "D1", longTfCutoff.toString()))
    }

    fun clearCache() {
        writableDatabase.delete("candles", null, null)
    }

    fun getStorageSizeBytes(): Long {
        val dbFile: File = context.getDatabasePath(DATABASE_NAME)
        return if (dbFile.exists()) dbFile.length() else 0L
    }

    private fun Candle.toValues(): ContentValues {
        return ContentValues().apply {
            put("symbol", symbol)
            put("timeframe", timeframe)
            put("open_time", openTime)
            put("close_time", closeTime)
            put("open", open)
            put("high", high)
            put("low", low)
            put("close", close)
            put("volume_tick", volumeTick)
            put("is_closed", if (isClosed) 1 else 0)
        }
    }

    companion object {
        private const val DATABASE_NAME = "amy_market_data.sqlite"
        private const val DATABASE_VERSION = 2
    }
}
