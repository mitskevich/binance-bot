import chalk from "chalk";
import * as fs from "fs";
import * as moment from "moment";
import { sprintf } from "printj";
import { CurrencyCandlestickRecord } from "./lib";

enum ReportFormat {
    Basic,
    MASell,
}

function analyzeCurrency(
    symbol: string,
    forceSellWindowMinutes: number,
    requiredProfitPercents: number,
    format: ReportFormat,
    maPredictionThreshold: number,
): void {
    console.log(symbol);
    const currencyData: CurrencyCandlestickRecord[] =
        JSON.parse(fs.readFileSync(`candlesticks-${symbol}BTC.json`).toString());

    const parsedData: Array<[Date, number, number, number, number, number]> = [];
    for (const record of currencyData) {
        const date = new Date(record.closeTime);
        const open = parseFloat(record.open);
        const close = parseFloat(record.close);
        const high = parseFloat(record.high);
        const low = parseFloat(record.low);
        const volume = parseFloat(record.volume);
        parsedData.push([date, open, close, high, low, volume]);
    }

    if (format === ReportFormat.Basic) {
        console.log("Date               Open         Close        Change  Low          " +
            "High          H-L    MA            C-MA     Sell");
    } else {
        console.log(
            "Date               Close        Change     Vol    MA60     MA240    MA720    " +
            "MA1440   Sell");
    }
    let lastClose = parsedData[0][2];
    let profitableMinutes = 0;
    const maPredictions = {
        ma60: [0, 0],
        ma240: [0, 0],
        ma720: [0, 0],
        ma1440: [0, 0],
    };
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < parsedData.length; i++) {
        const [date, open, close, high, low, volume] = parsedData[i];
        const highLowDistPercents = ((high - low) / low) * 100;
        const changePercents = ((close - lastClose) / lastClose) * 100;

        const [ma60, ma60Dist] = calculateMa(parsedData, i, 60);
        const ma240Dist = calculateMa(parsedData, i, 240)[1];
        const ma720Dist = calculateMa(parsedData, i, 720)[1];
        const ma1440Dist = calculateMa(parsedData, i, 1440)[1];

        let sellPrice: number | undefined;
        if (i + forceSellWindowMinutes < parsedData.length) {
            sellPrice = parsedData[i + forceSellWindowMinutes][2];
            for (let j = 0; j < forceSellWindowMinutes; j++) {
                const price = parsedData[i + forceSellWindowMinutes][3];
                if (price > close && price > sellPrice) {
                    sellPrice = price;
                }
            }
        }
        let sellPriceDisplay = "-";
        if (sellPrice !== undefined) {
            const sellProfit = sellPrice - close;
            const sellProfitRatio = sellProfit / close;
            const sellProfitPercents = (sellProfitRatio) * 100;
            sellPriceDisplay = sprintf("% 6.2f", sellProfitPercents) + "%";
            if (sellProfitPercents >= requiredProfitPercents) {
                profitableMinutes++;
                sellPriceDisplay = chalk.bold(chalk.green(sellPriceDisplay));
            }

            if (ma60Dist <= maPredictionThreshold) {
                if (sellProfitPercents >= requiredProfitPercents) {
                    maPredictions.ma60[0]++;
                } else {
                    maPredictions.ma60[1]++;
                }
            }
            if (ma240Dist <= maPredictionThreshold) {
                if (sellProfitPercents >= requiredProfitPercents) {
                    maPredictions.ma240[0]++;
                } else {
                    maPredictions.ma240[1]++;
                }
            }
            if (ma720Dist <= maPredictionThreshold) {
                if (sellProfitPercents >= requiredProfitPercents) {
                    maPredictions.ma720[0]++;
                } else {
                    maPredictions.ma720[1]++;
                }
            }
            if (ma1440Dist <= maPredictionThreshold) {
                if (sellProfitPercents >= requiredProfitPercents) {
                    maPredictions.ma1440[0]++;
                } else {
                    maPredictions.ma1440[1]++;
                }
            }
        }

        if (format === ReportFormat.Basic) {
            console.log(
                `${moment(date).format("YYYY-MM-DD HH:mm")}` +
                `   ${sprintf("%.8f", open)}` +
                `   ${sprintf("%.8f", close)}` +
                `  ${sprintf("% .2f", changePercents)}%` +
                `   ${sprintf("%.8f", low)}` +
                `   ${sprintf("%.8f", high)}` +
                `   ${sprintf("%4.1f", highLowDistPercents)}%` +
                `   ${sprintf("%.8f", ma60)}` +
                `  ${sprintf("% 6.2f", ma60Dist)}%` +
                `  ${sellPriceDisplay}` +
                ``);
        } else {
            console.log(
                `${moment(date).format("YYYY-MM-DD HH:mm")}` +
                `   ${sprintf("%.8f", close)}` +
                `  ${sprintf("% .2f", changePercents)}%` +
                `   ${sprintf("%6.1f", volume)}` +
                `  ${sprintf("% 6.2f", ma60Dist)}%` +
                `  ${sprintf("% 6.2f", ma240Dist)}%` +
                `  ${sprintf("% 6.2f", ma720Dist)}%` +
                `  ${sprintf("% 6.2f", ma1440Dist)}%` +
                `  ${sellPriceDisplay}` +
                ``);
        }

        lastClose = close;
    }

    console.log(`Profitable minutes: ${profitableMinutes}/${parsedData.length}`);
    console.log(`MA Predictions with ${forceSellWindowMinutes}m sell window:`);
    console.log(`   MA60:   ${maPredictions.ma60[0]} / ${maPredictions.ma60[1]}`);
    console.log(`   MA240:  ${maPredictions.ma240[0]} / ${maPredictions.ma240[1]}`);
    console.log(`   MA720:  ${maPredictions.ma720[0]} / ${maPredictions.ma720[1]}`);
    console.log(`   MA1440: ${maPredictions.ma1440[0]} / ${maPredictions.ma1440[1]}`);
}

function calculateMa(
    data: Array<[Date, number, number, number, number, number]>,
    i: number,
    steps: number,
): [number, number] {
    let sum = 0;
    for (let k = i; k > (i - steps) && k >= 0; k--) {
        sum += data[k][2];
    }
    const len = i - steps >= 0 ? steps : i + 1;
    const ma = sum / len;
    const percent = 100 * (data[i][2] - ma) / ma;
    return [ma, percent];
}

analyzeCurrency("XMR", 240, 2, ReportFormat.MASell, -3);
