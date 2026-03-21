import 'dotenv/config';

const API_KEY = process.env.API_FOOTBALL_KEY || '';
const API_HOST = 'v3.football.api-sports.io';

async function test() {
  const url = `https://${API_HOST}/players?team=492&season=2022&page=4`;
  const response = await fetch(url, {
    headers: {
      'x-apisports-key': API_KEY,
      'x-apisports-host': API_HOST,
    },
  });
  const data = await response.json();
  const lukaku = data.response?.find((p: any) => p.player.name.includes('Lukaku'));
  console.log('Lukaku in Napoli 2022 page 4:', lukaku ? 'Yes' : 'No');
  if (lukaku) {
    console.log(JSON.stringify(lukaku, null, 2));
  }
}

test();
