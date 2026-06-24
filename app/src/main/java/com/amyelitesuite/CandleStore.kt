package com.amyelitesuite

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class CandleStore(context: Context) : SQLiteOpenHelper(context, "amy_market_data.sqlite", null, 1) {

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
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_candles_lookup ON candles(symbol, timeframe, open_time)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        onCreate(db)
    }

    fun upsert(candle: Candle) {
        val values = ContentValues().apply {
            put("symbol", candle.symbol)
            put("timeframe", candle.timeframe)
            put("open_time", candle.openTime)
            put("close_time", candle.closeTime)
            put("open", candle.open)
            put("high", candle.high)
            put("low", candle.low)
            put("close", candle.close)
            put("volume_tick", candle.volumeTick)
            put("is_closed", if (candle.isClosed) 1 else 0)
        }
        writableDatabase.insertWithOnConflict("candles", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun upsertAll(candles: List<Candle>) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            candles.forEach { candle ->
                val values = ContentValues().apply {
                    put("symbol", candle.symbol)
                    put("timeframe", candle.timeframe)
                    put("open_time", candle.openTime)
                    put("close_time", candle.closeTime)
                    put("open", candle.open)
                    put("high", candle.high)
                    put("low", candle.low)
                    put("close", candle.close)
                    put("volume_tick", candle.volumeTick)
                    put("is_closed", if (candle.isClosed) 1 else 0)
                }
                db.insertWithOnConflict("candles", null, values, SQLiteDatabase.CONFLICT_REPLACE)
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
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
            arrayOf(symbol, timeframe, limit.toString())
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
            arrayOf(symbol, timeframe, symbol, timeframe, keepLatest)
        )
    }
}
