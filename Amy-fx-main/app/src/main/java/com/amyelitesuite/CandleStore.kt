package com.amyelitesuite

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class CandleStore(context: Context) : SQLiteOpenHelper(context, "amyfx_candles.db", null, 4) {

    data class Candle(
        val symbol: String,
        val timeframe: String,
        val openTime: Long,
        val closeTime: Long,
        val open: Double,
        val high: Double,
        val low: Double,
        val close: Double,
        val volumeTick: Int,
        val isClosed: Boolean
    )

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS candles (
                symbol      TEXT NOT NULL,
                timeframe   TEXT NOT NULL,
                open_time   INTEGER NOT NULL,
                close_time  INTEGER NOT NULL,
                open        REAL NOT NULL,
                high        REAL NOT NULL,
                low         REAL NOT NULL,
                close       REAL NOT NULL,
                volume_tick INTEGER DEFAULT 1,
                is_closed   INTEGER DEFAULT 1,
                PRIMARY KEY (symbol, timeframe, open_time)
            )
        """.trimIndent())
        createIndexes(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS candles")
        onCreate(db)
    }

    private fun createIndexes(db: SQLiteDatabase) {
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_candles_sym_tf ON candles(symbol, timeframe)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_candles_open_time ON candles(open_time DESC)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_candles_sym_tf_time ON candles(symbol, timeframe, open_time DESC)")
    }

    fun upsert(candle: Candle) {
        val cv = ContentValues().apply {
            put("symbol",      candle.symbol)
            put("timeframe",   candle.timeframe)
            put("open_time",   candle.openTime)
            put("close_time",  candle.closeTime)
            put("open",        candle.open)
            put("high",        candle.high)
            put("low",         candle.low)
            put("close",       candle.close)
            put("volume_tick", candle.volumeTick)
            put("is_closed",   if (candle.isClosed) 1 else 0)
        }
        writableDatabase.insertWithOnConflict("candles", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun upsertBatch(candles: List<Candle>) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            candles.forEach { candle ->
                val cv = ContentValues().apply {
                    put("symbol",      candle.symbol)
                    put("timeframe",   candle.timeframe)
                    put("open_time",   candle.openTime)
                    put("close_time",  candle.closeTime)
                    put("open",        candle.open)
                    put("high",        candle.high)
                    put("low",         candle.low)
                    put("close",       candle.close)
                    put("volume_tick", candle.volumeTick)
                    put("is_closed",   if (candle.isClosed) 1 else 0)
                }
                db.insertWithOnConflict("candles", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun getLatest(symbol: String, timeframe: String, limit: Int = 300): List<Candle> {
        val cursor = readableDatabase.rawQuery(
            """SELECT * FROM candles WHERE symbol=? AND timeframe=?
               ORDER BY open_time DESC LIMIT ?""",
            arrayOf(symbol, timeframe, limit.toString())
        )
        val result = mutableListOf<Candle>()
        cursor.use {
            while (it.moveToNext()) {
                result.add(Candle(
                    symbol    = it.getString(it.getColumnIndexOrThrow("symbol")),
                    timeframe = it.getString(it.getColumnIndexOrThrow("timeframe")),
                    openTime  = it.getLong(it.getColumnIndexOrThrow("open_time")),
                    closeTime = it.getLong(it.getColumnIndexOrThrow("close_time")),
                    open      = it.getDouble(it.getColumnIndexOrThrow("open")),
                    high      = it.getDouble(it.getColumnIndexOrThrow("high")),
                    low       = it.getDouble(it.getColumnIndexOrThrow("low")),
                    close     = it.getDouble(it.getColumnIndexOrThrow("close")),
                    volumeTick= it.getInt(it.getColumnIndexOrThrow("volume_tick")),
                    isClosed  = it.getInt(it.getColumnIndexOrThrow("is_closed")) == 1
                ))
            }
        }
        return result.reversed() // oldest first
    }

    /**
     * Auto-cleanup: keep 90 days for short TFs, 365 days for long TFs.
     * Runs via VACUUM to reclaim disk space.
     */
    fun cleanupOldCandles() {
        val now = System.currentTimeMillis()
        val shortTfCutoff = now - (90L * 24 * 60 * 60 * 1000)
        val longTfCutoff  = now - (365L * 24 * 60 * 60 * 1000)
        val shortTfs = listOf("M1", "M5", "M15", "M30")
        val db = writableDatabase
        shortTfs.forEach { tf ->
            db.execSQL("DELETE FROM candles WHERE timeframe=? AND open_time<?",
                arrayOf(tf, shortTfCutoff.toString()))
        }
        db.execSQL("DELETE FROM candles WHERE timeframe NOT IN ('M1','M5','M15','M30') AND open_time<?",
            arrayOf(longTfCutoff.toString()))
        db.execSQL("VACUUM")
    }

    /** Returns approximate storage size in bytes used by the candle cache. */
    fun getStorageSizeBytes(): Long {
        return try {
            readableDatabase.rawQuery("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()", null).use { c ->
                if (c.moveToFirst()) c.getLong(0) else 0L
            }
        } catch (e: Exception) {
            0L
        }
    }

    fun getCount(symbol: String, timeframe: String): Int {
        return readableDatabase.rawQuery(
            "SELECT COUNT(*) FROM candles WHERE symbol=? AND timeframe=?",
            arrayOf(symbol, timeframe)
        ).use { c -> if (c.moveToFirst()) c.getInt(0) else 0 }
    }

    fun clearAll() {
        writableDatabase.execSQL("DELETE FROM candles")
        writableDatabase.execSQL("VACUUM")
    }
}
