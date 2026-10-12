# Chart Gold gestures — Pro379

Chart Gold uses TradingView Lightweight Charts 4.2.3. Drag the right price axis vertically to change price scale; drag the bottom time axis horizontally to change candle width. Pinch zoom and plot panning remain available. Double-tap the price axis or select **Auto harga** to restore automatic price scaling.

The previous Mapping configuration set `handleScroll.vertTouchDrag` to false. Lightweight Charts' price-axis widget consequently treated vertical touch drags as page scrolling, despite enabling `axisPressedMouseMove`. Mapping now enables vertical touch handling; the shared Home chart retains its existing page-scroll behavior.

Official implementation references:

- [Price-axis widget](https://github.com/tradingview/lightweight-charts/blob/v4.2.3/src/gui/price-axis-widget.ts): touch drag and double-tap handlers, vertical page-scroll condition.
- [Time-axis widget](https://github.com/tradingview/lightweight-charts/blob/v4.2.3/src/gui/time-axis-widget.ts): horizontal touch scaling.
- [Mouse/touch event handler](https://github.com/tradingview/lightweight-charts/blob/v4.2.3/src/gui/mouse-event-handler.ts): gesture routing.
- [Price scale](https://github.com/tradingview/lightweight-charts/blob/v4.2.3/src/model/price-scale.ts): manual scaling disables autoscale.

ICT/AMY canvas geometry is reprojected during gestures using the chart's current price coordinates. Plot bounds use the measured price/time axis dimensions. Data refresh applies the configured right offset only when that preference changes, preserving manual pan and scale. Trading rules, server context, persisted display controls, and candle ownership are unchanged.

Validation: all 142 regression files passed. Chromium touch tests verified price-axis scaling, time-axis candle width, overlay alignment, double-tap and Auto harga resets, and manual viewport preservation after refresh. Existing fullscreen portrait/landscape, Back/Escape, pinch, pan, theme, narrow layout, and offline-clearing checks also passed with no browser errors. Actual Android device gestures and update notification receipt remain unobserved.
