import type { Mountain } from '../lib/verify.ts';

export type Stamp = { mountainId: string; verifiedAt: string };

type Props = { stamps: Stamp[]; mountains: Mountain[] };

export function MyStamps({ stamps, mountains }: Props) {
  if (stamps.length === 0) {
    return (
      <main className="screen screen-tabbed">
        <h1 className="title">내 스탬프</h1>
        <p className="notice">
          아직 모은 스탬프가 없어요. 정상에 도착해서 인증하면 여기에 쌓여요.
        </p>
      </main>
    );
  }

  return (
    <main className="screen screen-tabbed">
      <h1 className="title">내 스탬프</h1>
      <p className="subtitle">{stamps.length}개를 모았어요</p>

      <ul className="list">
        {stamps.map((stamp) => {
          const mountain = mountains.find((m) => m.id === stamp.mountainId);
          return (
            <li key={`${stamp.mountainId}-${stamp.verifiedAt}`}>
              <div className="row row-static">
                <span className="row-main">
                  <span className="row-title">{mountain?.name ?? stamp.mountainId}</span>
                  <span className="row-meta">{stamp.verifiedAt}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
