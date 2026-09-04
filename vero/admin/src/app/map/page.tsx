'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api, type LiveVehicle, type MapBin } from '@/lib/api';
import { Shell } from '@/components/Shell';
import { ErrorBox, Loading, useData } from '@/components/ui';

/**
 * نمط الخريطة الافتراضي: OpenStreetMap عبر MapLibre — مجاني وبلا مفتاح.
 * تستطيع الشركة استبداله بأي نمط مدفوع عبر NEXT_PUBLIC_MAP_STYLE.
 */
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© مساهمو OpenStreetMap',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

const STATE_COLOR: Record<string, string> = {
  DONE: '#16a34a',
  PENDING: '#9ca3af',
  REVIEW: '#d97706',
  PROBLEM: '#dc2626',
};

const STATE_AR: Record<string, string> = {
  DONE: 'تمت الخدمة',
  PENDING: 'لم تتم',
  REVIEW: 'تحتاج مراجعة',
  PROBLEM: 'مشكلة',
};

export default function MapPage() {
  const bins = useData<{ items: MapBin[] }>(() => api('/v1/bins/map'));
  const live = useData<{ items: LiveVehicle[] }>(() => api('/v1/routes/live'));
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Shell title="الخريطة">
      {bins.error != null ? (
        <ErrorBox error={bins.error} onRetry={bins.reload} />
      ) : bins.loading ? (
        <Loading rows={6} />
      ) : (
        <>
          <div className="toolbar">
            {(['DONE', 'PENDING', 'REVIEW', 'PROBLEM'] as const).map((s) => {
              const n = bins.data?.items.filter((b) => b.state === s).length ?? 0;
              return (
                <span key={s} className="pill muted">
                  <span className="dot" style={{ background: STATE_COLOR[s] }} />
                  {STATE_AR[s]}: <span className="num">{n}</span>
                </span>
              );
            })}
            <div className="spacer" />
            <button
              className="btn sm"
              onClick={() => {
                bins.reload();
                live.reload();
              }}
            >
              تحديث
            </button>
          </div>

          <MapCanvas
            bins={bins.data?.items ?? []}
            vehicles={live.data?.items ?? []}
            onSelectVehicle={setSelected}
          />

          {selected && <RouteTrack sessionId={selected} onClose={() => setSelected(null)} />}
        </>
      )}
    </Shell>
  );
}

function MapCanvas({
  bins,
  vehicles,
  onSelectVehicle,
}: {
  bins: MapBin[];
  vehicles: LiveVehicle[];
  onSelectVehicle: (sessionId: string | null) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const clusterLabels = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!holder.current || map.current) return;
    const custom = process.env.NEXT_PUBLIC_MAP_STYLE;
    const m = new maplibregl.Map({
      container: holder.current,
      style: custom && custom.length > 0 ? custom : OSM_STYLE,
      center: [46.6753, 24.7136],
      zoom: 11,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    m.on('load', () => setReady(true));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // الحاويات كطبقة تجميع (Clustering) — لا نرسم آلاف العلامات فرادى
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: bins.map((b) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [b.lon, b.lat] },
        properties: { id: b.id, publicId: b.publicId, state: b.state, sector: b.sector ?? '' },
      })),
    };

    const src = m.getSource('bins') as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
      return;
    }

    m.addSource('bins', {
      type: 'geojson',
      data,
      cluster: true,
      clusterRadius: 55,
      clusterMaxZoom: 14,
    });

    m.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'bins',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#0F4C4A',
        'circle-opacity': 0.85,
        'circle-radius': ['step', ['get', 'point_count'], 16, 50, 22, 250, 30],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });
    // ملاحظة: لا نستخدم طبقة نصوص (symbol) لعرض عدد العناصر داخل التجميعة،
    // لأن MapLibre يتطلب خادم glyphs خارجيًا لرسم النصوص. نرسم الأعداد كعناصر
    // DOM فوق الخريطة بدلًا من ذلك، فيبقى النظام يعمل بلا أي اتصال خارجي.
    m.addLayer({
      id: 'bin-points',
      type: 'circle',
      source: 'bins',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 7,
        'circle-color': [
          'match',
          ['get', 'state'],
          'DONE',
          STATE_COLOR.DONE,
          'REVIEW',
          STATE_COLOR.REVIEW,
          'PROBLEM',
          STATE_COLOR.PROBLEM,
          STATE_COLOR.PENDING,
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
      },
    });

    m.on('click', 'clusters', (e) => {
      const f = m.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
      if (!f) return;
      const clusterId = f.properties?.cluster_id as number;
      const source = m.getSource('bins') as maplibregl.GeoJSONSource;
      void source.getClusterExpansionZoom(clusterId).then((zoom) => {
        m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
    });

    m.on('click', 'bin-points', (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as { publicId: string; state: string; sector: string };
      new maplibregl.Popup({ closeButton: true })
        .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(
          `<div style="font-family:inherit;direction:rtl;text-align:right;min-width:130px">
             <div style="font-weight:700">${p.publicId}</div>
             <div style="font-size:12px;color:#6b7280">${STATE_AR[p.state] ?? p.state}</div>
             ${p.sector ? `<div style="font-size:12px;color:#6b7280">${p.sector}</div>` : ''}
           </div>`,
        )
        .addTo(m);
    });

    for (const layer of ['clusters', 'bin-points']) {
      m.on('mouseenter', layer, () => {
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', layer, () => {
        m.getCanvas().style.cursor = '';
      });
    }

    if (bins.length > 0) {
      const b = new maplibregl.LngLatBounds();
      for (const p of bins) b.extend([p.lon, p.lat]);
      m.fitBounds(b, { padding: 60, maxZoom: 15, duration: 0 });
    }
  }, [bins, ready]);

  // أعداد التجميعات كعناصر DOM (بديل طبقة النصوص التي تحتاج glyphs خارجية)
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    const render = () => {
      for (const mk of clusterLabels.current) mk.remove();
      clusterLabels.current = [];
      if (!m.getLayer('clusters')) return;

      for (const f of m.queryRenderedFeatures({ layers: ['clusters'] })) {
        const count = f.properties?.point_count as number | undefined;
        if (!count) continue;
        const el = document.createElement('div');
        el.textContent = count > 999 ? `${Math.round(count / 100) / 10}k` : String(count);
        el.style.cssText =
          'color:#fff;font:600 12px/1 var(--font);pointer-events:none;' +
          'text-shadow:0 1px 2px rgba(0,0,0,.35);user-select:none';
        clusterLabels.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
            .addTo(m),
        );
      }
    };

    render();
    m.on('move', render);
    m.on('sourcedata', render);
    return () => {
      m.off('move', render);
      m.off('sourcedata', render);
      for (const mk of clusterLabels.current) mk.remove();
      clusterLabels.current = [];
    };
  }, [bins, ready]);

  // السيارات كعلامات حيّة (عددها صغير)
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    for (const mk of markers.current) mk.remove();
    markers.current = [];

    for (const v of vehicles) {
      if (v.lat === null || v.lon === null) continue;
      const el = document.createElement('div');
      el.style.cssText = `width:30px;height:30px;border-radius:50%;display:flex;align-items:center;
        justify-content:center;font-size:15px;cursor:pointer;border:2.5px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,.3);background:${v.online ? '#0F4C4A' : '#9ca3af'}`;
      el.textContent = '🚛';
      el.title = `${v.internalNo} — ${v.workerName ?? 'بلا سائق'}`;
      el.onclick = () => onSelectVehicle(v.sessionId);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([v.lon, v.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 18 }).setHTML(
            `<div style="direction:rtl;text-align:right;min-width:150px;font-family:inherit">
               <div style="font-weight:700">سيارة ${v.internalNo}</div>
               <div style="font-size:12px">${v.workerName ?? 'بلا سائق'}</div>
               <div style="font-size:12px;color:#6b7280">تم اليوم: ${v.doneToday}</div>
               <div style="font-size:12px;color:${v.online ? '#16a34a' : '#dc2626'}">
                 ${v.online ? 'متصلة' : 'غير متصلة'}
               </div>
             </div>`,
          ),
        )
        .addTo(m);
      markers.current.push(marker);
    }
  }, [vehicles, ready, onSelectVehicle]);

  return (
    <div className="map-wrap">
      <div ref={holder} style={{ position: 'absolute', inset: 0 }} />
      <div className="map-legend">
        <div style={{ fontWeight: 600, marginBottom: 4 }}>حالة الحاويات</div>
        {(['DONE', 'PENDING', 'REVIEW', 'PROBLEM'] as const).map((s) => (
          <div key={s}>
            <span className="dot" style={{ background: STATE_COLOR[s] }} />
            {STATE_AR[s]}
          </div>
        ))}
      </div>
    </div>
  );
}

interface TrackResponse {
  session: { id: string; vehicleNo: string | null; workerName: string | null; distanceM: number };
  geojson: GeoJSON.Feature<GeoJSON.LineString>;
  scans: { id: string; binPublicId: string; status: string }[];
}

function RouteTrack({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const track = useData<TrackResponse>(() => api(`/v1/routes/sessions/${sessionId}`), [sessionId]);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-head">
        <h2>خط سير الجلسة</h2>
        <div className="spacer" />
        <button className="btn sm" onClick={onClose}>
          إغلاق
        </button>
      </div>
      <div className="card-body">
        {track.error != null ? (
          <ErrorBox error={track.error} onRetry={track.reload} />
        ) : track.loading ? (
          <Loading rows={2} />
        ) : track.data ? (
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <div>
              <div className="hint">السيارة</div>
              <div style={{ fontWeight: 600 }}>{track.data.session.vehicleNo ?? '—'}</div>
            </div>
            <div>
              <div className="hint">السائق</div>
              <div style={{ fontWeight: 600 }}>{track.data.session.workerName ?? '—'}</div>
            </div>
            <div>
              <div className="hint">مسافة السير</div>
              <div style={{ fontWeight: 600 }} className="num">
                {(track.data.session.distanceM / 1000).toFixed(2)} كم
              </div>
            </div>
            <div>
              <div className="hint">نقاط المسار</div>
              <div style={{ fontWeight: 600 }} className="num">
                {track.data.geojson.geometry.coordinates.length}
              </div>
            </div>
            <div>
              <div className="hint">زيارات في الجلسة</div>
              <div style={{ fontWeight: 600 }} className="num">
                {track.data.scans.length}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
