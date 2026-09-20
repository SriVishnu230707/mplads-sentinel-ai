import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Project } from './data'

export type MapMode = 'risk' | 'satellite' | 'district'

interface GisMapProps {
  projects: Project[]
  onSelect: (p: Project) => void
  mode?: MapMode
  selectedState?: string
  isDark?: boolean
  compact?: boolean
  height?: string
}

const STATE_COORDINATES: Record<string, [number, number, number]> = {
  'all': [22.2, 78.9, 5],
  'Karnataka': [14.4, 75.8, 7],
  'Uttar Pradesh': [26.8, 80.9, 7],
  'Maharashtra': [19.2, 75.7, 7],
  'Assam': [26.2, 92.9, 7],
  'Tamil Nadu': [11.1, 78.6, 7],
}

export function GisMap({
  projects,
  onSelect,
  mode = 'satellite',
  selectedState = 'all',
  isDark = false,
  compact = false,
  height = '100%',
}: GisMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const baseLayerRef = useRef<L.TileLayer | null>(null)
  const labelsLayerRef = useRef<L.TileLayer | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const initialCenter = STATE_COORDINATES[selectedState] ?? STATE_COORDINATES['all']
    const map = L.map(containerRef.current, {
      center: [initialCenter[0], initialCenter[1]],
      zoom: initialCenter[2],
      zoomControl: !compact,
      attributionControl: !compact,
      scrollWheelZoom: !compact,
    })

    const markersGroup = L.layerGroup().addTo(map)
    markersLayerRef.current = markersGroup
    mapRef.current = map

    // Handle popup click delegation
    const container = containerRef.current
    const handlePopupClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.gis-popup-btn')
      if (target) {
        const projectId = target.getAttribute('data-project-id')
        const found = projects.find(p => p.id === projectId)
        if (found) {
          onSelectRef.current(found)
        }
      }
    }
    container.addEventListener('click', handlePopupClick)

    // Invalidate size on mount and container resizing
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize()
    })
    resizeObserver.observe(containerRef.current)

    const timer = window.setTimeout(() => map.invalidateSize(), 200)

    return () => {
      window.clearTimeout(timer)
      resizeObserver.disconnect()
      container.removeEventListener('click', handlePopupClick)
      map.remove()
      mapRef.current = null
      baseLayerRef.current = null
      labelsLayerRef.current = null
      markersLayerRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Tile Layers based on Mode & Theme
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove previous base & label layers
    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current)
      baseLayerRef.current = null
    }
    if (labelsLayerRef.current) {
      map.removeLayer(labelsLayerRef.current)
      labelsLayerRef.current = null
    }

    if (mode === 'satellite') {
      // High-resolution Esri World Imagery
      baseLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
          maxZoom: 19,
        }
      ).addTo(map)

      // Overlay boundaries & labels so cities and borders are visible over satellite
      labelsLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          opacity: 0.85,
        }
      ).addTo(map)
    } else if (mode === 'district') {
      // CartoDB Voyager with clean administrative outlines
      baseLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
          subdomains: 'abcd',
        }
      ).addTo(map)
    } else {
      // 'risk' mode: sleek Carto Positron (light/dark adaptive)
      const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

      baseLayerRef.current = L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map)
    }
  }, [mode, isDark])

  // Handle State Pan/Zoom
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const target = STATE_COORDINATES[selectedState]
    if (target) {
      map.flyTo([target[0], target[1]], target[2], { duration: 1.2 })
    }
  }, [selectedState])

  // Render Project Markers
  useEffect(() => {
    const map = mapRef.current
    const markersGroup = markersLayerRef.current
    if (!map || !markersGroup) return

    markersGroup.clearLayers()

    const validMarkers: L.Marker[] = []

    projects.forEach(project => {
      // Use real GPS coordinates if available, otherwise compute fallback
      const lat = project.latitude ?? (project.lat ? (90 - project.lat) / 1.45 : 20.5)
      const lng = project.longitude ?? (project.lng ? project.lng / 4.2 + 67 : 78.9)

      const levelClass = project.level.toLowerCase()
      const html = `
        <div class="gis-marker-pin pin-${levelClass}">
          <span class="pulse-ring"></span>
          <span class="core-dot"></span>
          <b class="score-pill">${project.risk}</b>
        </div>
      `

      const icon = L.divIcon({
        html,
        className: 'sentinel-gis-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      })

      const marker = L.marker([lat, lng], { icon })

      const popupContent = `
        <div class="gis-popup">
          <div class="gis-popup-top">
            <span class="risk-badge risk-${levelClass}"><i></i>${project.risk} ${project.level}</span>
            <span class="gis-popup-id">${project.id}</span>
          </div>
          <h4 class="gis-popup-title">${project.title}</h4>
          <p class="gis-popup-loc">${project.location}</p>
          <div class="gis-popup-metrics">
            <div><span>Sanctioned</span><strong>₹${(project.sanctioned / 100).toFixed(2)} Cr</strong></div>
            <div><span>Spent</span><strong>₹${(project.spent / 100).toFixed(2)} Cr</strong></div>
            <div><span>Progress</span><strong>${project.progress}%</strong></div>
          </div>
          <p class="gis-popup-issue">${project.issue}</p>
          <button type="button" class="gis-popup-btn" data-project-id="${project.id}">
            Open Risk Intelligence &rarr;
          </button>
        </div>
      `

      marker.bindPopup(popupContent, {
        className: 'sentinel-leaflet-popup',
        maxWidth: 280,
      })

      marker.on('click', () => {
        // Also fire selection on marker click
        onSelectRef.current(project)
      })

      markersGroup.addLayer(marker)
      validMarkers.push(marker)
    })
  }, [projects])

  return (
    <div
      ref={containerRef}
      className={`gis-map-viewport ${compact ? 'compact' : ''} ${mode}`}
      style={{ width: '100%', height, minHeight: compact ? '220px' : '520px' }}
    />
  )
}
