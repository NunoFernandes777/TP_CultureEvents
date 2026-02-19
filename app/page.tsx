"use client";

import { useState, useEffect } from "react";

type Event = {
  id?: number;
  uid?: string;
  title: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  event_date?: string | null;
  category?: string;
};

const CATEGORY_KEYWORDS = {
  music: [
    "concert",
    "musique",
    "music",
    "son",
    "acoustique",
    "acoustic",
    "jazz",
    "rock",
    "rap",
    "hip hop",
    "hip-hop",
    "electro",
    "electronic",
    "pop",
    "blues",
    "folk",
    "opera",
    "symphonie",
    "symphony",
    "philharmonique",
    "philharmonic",
    "dj",
    "set dj",
    "set live",
    "chorale",
    "choir",
    "orchestra",
    "orchestre",
    "festival",
    "recital",
    "live",
    "karaoke",
    "musician",
    "musicien",
  ],
  exhibition: [
    "exposition",
    "exhibit",
    "museum",
    "musee",
    "galerie",
    "gallery",
    "vernissage",
    "art",
    "arts visuels",
    "visual art",
    "peinture",
    "painting",
    "sculpture",
    "installation",
    "collection",
    "patrimoine",
    "heritage",
    "historique",
    "history",
    "photography",
    "photo",
    "dessin",
    "drawing",
  ],
  theater: [
    "theatre",
    "theater",
    "piece",
    "play",
    "scene",
    "comedie",
    "comedy",
    "drama",
    "spectacle",
    "stand-up",
    "stand up",
    "impro",
    "improv",
    "performance",
    "acteur",
    "actor",
    "actrice",
    "actress",
    "mise en scene",
    "one man show",
    "one woman show",
  ],
  workshop: [
    "atelier",
    "workshop",
    "masterclass",
    "formation",
    "training",
    "cours",
    "class",
    "initiation",
    "conference",
    "seminaire",
    "seminar",
    "table ronde",
    "roundtable",
    "rencontre",
    "discussion",
    "apprentissage",
    "learning",
    "stage",
    "bootcamp",
  ],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function categorizeEvent(text: string = ""): string {
  const t = normalizeText(text);

  if (CATEGORY_KEYWORDS.music.some((word) => t.includes(word))) return "music";
  if (CATEGORY_KEYWORDS.exhibition.some((word) => t.includes(word))) {
    return "exhibition";
  }
  if (CATEGORY_KEYWORDS.theater.some((word) => t.includes(word))) return "theater";
  if (CATEGORY_KEYWORDS.workshop.some((word) => t.includes(word))) return "workshop";

  return "other";
}

export default function Dashboard() {
  const [items, setItems] = useState<Event[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const pageSize = 5;

  useEffect(() => {
    fetch(`/api/items?page=1&pageSize=5000`)
      .then((res) => res.json())
      .then((data) => {
        const enriched = data.items.map((item: Event) => ({
          ...item,
          category: categorizeEvent(
            (item.title || "") + " " + (item.description || "")
          ),
        }));
        setItems(enriched);
      });
  }, []);

  const filteredItems = items.filter(
    (item) => !categoryFilter || item.category === categoryFilter
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [categoryFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedItems = filteredItems.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const emptyRows = Math.max(0, pageSize - paginatedItems.length);
  const noResults = filteredItems.length === 0;

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-title">Cultural Events Dashboard</h1>

      <div className="filter-bar">
        <label className="filter-label">
          Category:{" "}
          <select
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="music">Music</option>
            <option value="exhibition">Exhibition</option>
            <option value="theater">Theater</option>
            <option value="workshop">Workshop</option>
            <option value="other">Other</option>
          </select>
        </label>
        <span className="filter-count">
          {filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="table-shell">
        <table className="events-table">
          <thead>
            <tr className="table-header-row">
              <th className="col-title">Title</th>
              <th className="col-date">Date</th>
              <th className="col-city">City</th>
              <th className="col-country">Country</th>
              <th className="col-category">Category</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {noResults && (
              <tr>
                <td colSpan={6} className="no-results">
                  No events found
                </td>
              </tr>
            )}
            {paginatedItems.map((item, index) => (
              <tr key={item.id ?? item.uid ?? `event-${index}`}>
                <td className="event-cell">
                  <span className="cell-text">{item.title || "-"}</span>
                </td>
                <td className="event-cell">
                  <span className="cell-text">{item.event_date || "-"}</span>
                </td>
                <td className="event-cell">
                  <span className="cell-text">{item.city || "-"}</span>
                </td>
                <td className="event-cell">
                  <span className="cell-text">{item.country || "-"}</span>
                </td>
                <td className="event-cell event-category-cell">
                  <span className="cell-text">{item.category || "-"}</span>
                </td>
                <td className="event-cell">
                  <button
                    className="event-info-btn"
                    onClick={() => setSelectedEvent(item)}
                  >
                    More info
                  </button>
                </td>
              </tr>
            ))}
            {!noResults &&
              Array.from({ length: emptyRows }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="empty-cell">&nbsp;</td>
                  <td className="empty-cell">&nbsp;</td>
                  <td className="empty-cell">&nbsp;</td>
                  <td className="empty-cell">&nbsp;</td>
                  <td className="empty-cell">&nbsp;</td>
                  <td className="empty-cell">&nbsp;</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          className="page-btn"
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page === 1}
        >
          Previous
        </button>
        <span className="page-indicator">
          Page {page} / {totalPages}
        </span>
        <button
          className="page-btn"
          onClick={() => setPage((p) => p + 1)}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>

      {selectedEvent && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedEvent(null)}
          role="presentation"
        >
          <div
            className="event-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-modal-title"
          >
            <h2 id="event-modal-title">
              {selectedEvent.title || "Untitled event"}
            </h2>
            <p>
              <strong>Date:</strong> {selectedEvent.event_date || "-"}
            </p>
            <p>
              <strong>City:</strong> {selectedEvent.city || "-"}
            </p>
            <p>
              <strong>Country:</strong> {selectedEvent.country || "-"}
            </p>
            <p>
              <strong>Category:</strong> {selectedEvent.category || "-"}
            </p>
            <p>
              <strong>Description:</strong> {selectedEvent.description || "-"}
            </p>
            <button
              className="event-info-btn modal-close-btn"
              onClick={() => setSelectedEvent(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
