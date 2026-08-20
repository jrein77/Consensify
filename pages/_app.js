import Head from "next/head";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Consensify</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images/ConsensifyIcon.png" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
