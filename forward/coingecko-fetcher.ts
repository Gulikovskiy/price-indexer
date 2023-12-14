import "server-only";
import { PriceRawResponse } from "../pages/api/historical-price";
import { get } from "../session/session-store";
export const fetchCoingeckoPrice = async () => {
  const url = `https://api.coingecko.com/api/v3/coins/usd-coin/contract/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48/market_chart/range?vs_currency=usd&from=1701900000&to=17024839700&precision=4`;

  const res = await fetch(url);
  if (res.status !== 200) {
    console.error("Coingecko API failed with code %s", res.status);
    return null;
  }
  const response = res
    .json()
    .then((el: PriceRawResponse) =>
      el.prices.map((el) => ({ timestamp: el[0], price: el[1] }))
    );

  // Getting the user's name from the session
  const username = await get("username");

  console.log(username); // Outputs: 'John Doe'
  return response;
  //   res.prices.map((el) => ({ timestamp: el[0], price: el[1] }))
};
