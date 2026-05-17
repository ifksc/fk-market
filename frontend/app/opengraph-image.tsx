import { ImageResponse } from 'next/og';

// Картинка для превью при шаринге ссылок в соцсетях и мессенджерах.
export const alt = 'FK.market — цифровые товары с автовыдачей';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #4f46e5 0%, #a855f7 52%, #ec4899 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: -3 }}>
          FK.market
        </div>
        <div style={{ fontSize: 40, opacity: 0.92, marginTop: 12 }}>
          Digital goods store
        </div>
        <div style={{ fontSize: 30, opacity: 0.8, marginTop: 36 }}>
          instant delivery 24/7
        </div>
      </div>
    ),
    { ...size },
  );
}
