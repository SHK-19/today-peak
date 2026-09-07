import { useEffect, useState } from 'react';

import { Close } from './icons.tsx';
import { fetchCourse } from '../lib/api.ts';
import {
  MAP_H,
  MAP_W,
  formatKm,
  formatMinutes,
  groupPois,
  mapFrame,
  staticMapUrl,
  type CourseDetail,
  type CourseSummary,
} from '../lib/courses.ts';

const MAP_KEY_ID = import.meta.env.VITE_NAVER_MAP_KEY_ID as string | undefined;
import { useSystemBack } from '../lib/useSystemBack.ts';

type Props = { course: CourseSummary; onClose: () => void };

// 코스 하나. 목록의 요약은 이미 있으니 먼저 그리고, 지점 목록만 불러와 아래에 붙인다.
export function CourseSheet({ course, onClose }: Props) {
  useSystemBack(true, onClose);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCourse(course.id)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [course.id]);

  const groups = detail === null ? [] : groupPois(detail.pois);
  const frame = detail === null ? null : mapFrame(detail.track);
  const mapUrl = frame === null ? null : staticMapUrl(frame, MAP_KEY_ID);

  return (
    <div className="sheet-dim" onClick={onClose} role="presentation">
      <section
        className="sheet sheet-tall"
        role="dialog"
        aria-label={`${course.name} 코스`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <div>
            <h2>{course.name}</h2>
            <p>
              <span className={`badge badge-${course.difficulty}`}>{course.difficulty}</span>
              {course.isLoop ? ' 들머리로 돌아오는 코스' : ' 다른 곳으로 내려가는 코스'}
            </p>
          </div>
          <button type="button" className="sheet-close" aria-label="닫기" onClick={onClose}>
            <Close size={22} />
          </button>
        </header>

        {frame !== null && (
          <figure className="course-map" aria-label="코스 위치">
            {mapUrl !== null && <img src={mapUrl} alt="" width={MAP_W} height={MAP_H} />}
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
              <polyline
                points={frame.points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
                fill="none"
                stroke="var(--brand-accent)"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={frame.points[0][0]} cy={frame.points[0][1]} r="6" fill="var(--brand-primary)" stroke="#fff" strokeWidth="2" />
            </svg>
            <figcaption>{mapUrl === null ? '코스 모양 · 초록 점이 시작점' : '지도 네이버 · 초록 점이 시작점'}</figcaption>
          </figure>
        )}

        <ul className="course-stats">
          <li>
            <span>거리</span>
            <strong>{formatKm(course.distanceM)}</strong>
          </li>
          <li>
            <span>예상 시간</span>
            <strong>{formatMinutes(course.minutes)}</strong>
          </li>
          <li>
            <span>누적 오르막</span>
            <strong>{course.ascentM}m</strong>
          </li>
          <li>
            <span>칼로리</span>
            <strong>{course.kcal}kcal</strong>
          </li>
        </ul>
        <p className="footnote">
          시간은 4.5km/h에 오르막 10m마다 1분을 더한 값, 칼로리는 70kg 기준이에요. 실제와 달라요.
        </p>

        <ul className="course-route">
          {course.startName !== null && (
            <li>
              <span>들머리</span>
              <strong>{course.startName}</strong>
            </li>
          )}
          {course.peakName !== null && (
            <li>
              <span>정상</span>
              <strong>
                {course.peakName}
                {course.peakEleM !== null && ` · ${course.peakEleM}m`}
              </strong>
            </li>
          )}
        </ul>

        {failed ? (
          <p className="footnote">코스 지점을 불러오지 못했어요.</p>
        ) : detail === null ? (
          <p className="footnote">코스 지점을 불러오고 있어요</p>
        ) : groups.length === 0 ? (
          <p className="footnote">이 코스에는 기록된 지점이 없어요.</p>
        ) : (
          <ul className="facility-list">
            {groups.map((group) => (
              <li key={group.label} className={group.label === '주의' ? 'course-danger' : undefined}>
                <strong>{group.label}</strong>
                <span>{group.names.join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="footnote">한국등산트레킹지원센터 GPX 기록이에요. 길과 시설은 달라졌을 수 있어요.</p>
      </section>
    </div>
  );
}
