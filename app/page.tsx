"use client";

import { useEffect, useMemo, useState } from "react";

type EventItem = {
  id?: number;
  uid?: string;
  title: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  event_date?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  category?: string | null;
  category_label?: string | null;
  is_free?: number | boolean | null;
  min_amount?: number | null;
  currency?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPricing(item: EventItem) {
  const isFree = Number(item.is_free) === 1 || item.is_free === true;
  if (isFree) return "Free";
  if (item.min_amount !== null && item.min_amount !== undefined) {
    return `${item.min_amount} ${item.currency || "EUR"}`;
  }
  return "-";
}

export default function Dashboard() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [pricingFilter, setPricingFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [newsPageIndex, setNewsPageIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const pageSize = 8;

  useEffect(() => {
    fetch("/api/items?page=1&pageSize=5000")
      .then((res) => res.json())
      .then((data) => setItems(data.items || []));
  }, []);

  const categories = useMemo(() => {
    const values = new Set(
      items.map((item) => item.category).filter((v): v is string => Boolean(v))
    );
    return Array.from(values).sort();
  }, [items]);

  const cities = useMemo(() => {
    const values = new Set(
      items.map((item) => item.city).filter((v): v is string => Boolean(v))
    );
    return Array.from(values).sort((a, b) => a.localeCompare(b, "fr"));
  }, [items]);

  const citySuggestions = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return [];
    return cities.filter((city) => city.toLowerCase().startsWith(q)).slice(0, 8);
  }, [cities, citySearch]);

  function applyCityFilter(rawValue: string) {
    const value = rawValue.trim();
    if (!value) {
      setSelectedCity("");
      return;
    }
    const exact = cities.find((city) => city.toLowerCase() === value.toLowerCase());
    setSelectedCity(exact || value);
    if (exact) setCitySearch(exact);
  }

  const filteredItems = useMemo(() => {
    const now = Date.now();
    return items.filter((item) => {
      const categoryOk = !categoryFilter || item.category === categoryFilter;
      const cityOk = !selectedCity || item.city === selectedCity;
      const isFree = Number(item.is_free) === 1 || item.is_free === true;
      const hasPrice = item.min_amount !== null && item.min_amount !== undefined;
      const pricingOk =
        !pricingFilter ||
        (pricingFilter === "free" && isFree) ||
        (pricingFilter === "paid" && hasPrice && !isFree) ||
        (pricingFilter === "unknown" && !isFree && !hasPrice);
      const eventTime = new Date(item.starts_at || item.event_date || "").getTime();
      const hasValidDate = Number.isFinite(eventTime);
      const dateOk =
        !dateFilter ||
        (dateFilter === "upcoming" && hasValidDate && eventTime >= now) ||
        (dateFilter === "past" && hasValidDate && eventTime < now) ||
        (dateFilter === "unknown" && !hasValidDate);
      return categoryOk && cityOk && pricingOk && dateOk;
    });
  }, [items, selectedCity, categoryFilter, pricingFilter, dateFilter]);

  const newsItems = useMemo(() => {
    const cityCounts = new Map<string, number>();
    const monthCounts = new Map<number, number>();
    const categoryCounts = new Map<string, number>();
    let freeCount = 0;
    let upcomingCount = 0;
    let nextUpcomingTime = Number.POSITIVE_INFINITY;
    let nextUpcomingLabel = "N/A";

    const now = Date.now();
    for (const item of items) {
      const city = item.city || "Unknown city";
      cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      const category = item.category_label || item.category || "Other";
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

      const isFree = Number(item.is_free) === 1 || item.is_free === true;
      if (isFree) freeCount += 1;

      const d = new Date(item.starts_at || item.event_date || "");
      if (!Number.isNaN(d.getTime())) {
        const m = d.getMonth();
        monthCounts.set(m, (monthCounts.get(m) || 0) + 1);
        const t = d.getTime();
        if (t >= now) {
          upcomingCount += 1;
          if (t < nextUpcomingTime) {
            nextUpcomingTime = t;
            nextUpcomingLabel = `${formatDate(d.toISOString())} - ${item.city || "Unknown city"}`;
          }
        }
      }
    }

    let topCity = "N/A";
    let topCityCount = 0;
    for (const [city, count] of cityCounts.entries()) {
      if (count > topCityCount) {
        topCity = city;
        topCityCount = count;
      }
    }

    let topMonthIndex = -1;
    let topMonthCount = 0;
    for (const [m, count] of monthCounts.entries()) {
      if (count > topMonthCount) {
        topMonthIndex = m;
        topMonthCount = count;
      }
    }
    const topMonth =
      topMonthIndex >= 0
        ? new Date(2026, topMonthIndex, 1).toLocaleString("en-US", { month: "long" })
        : "N/A";

    let topCategory = "N/A";
    let topCategoryCount = 0;
    for (const [category, count] of categoryCounts.entries()) {
      if (count > topCategoryCount) {
        topCategory = category;
        topCategoryCount = count;
      }
    }

    const freeRate = items.length ? Math.round((freeCount / items.length) * 100) : 0;

    return [
      {
        label: "Most active city",
        value: topCity,
        sub: `${topCityCount} events`,
      },
      {
        label: "Most active month",
        value: topMonth,
        sub: `${topMonthCount} events`,
      },
      {
        label: "Top category",
        value: topCategory,
        sub: `${topCategoryCount} events`,
      },
      {
        label: "Free events ratio",
        value: `${freeRate}%`,
        sub: `${freeCount}/${items.length || 0} events`,
      },
      {
        label: "Upcoming events",
        value: String(upcomingCount),
        sub: `next: ${nextUpcomingLabel}`,
      },
      {
        label: "Active cities",
        value: String(cityCounts.size),
        sub: "cities with events",
      },
    ];
  }, [items]);

  const newsPages = useMemo(() => {
    const pages: Array<typeof newsItems> = [];
    for (let i = 0; i < newsItems.length; i += 2) {
      pages.push(newsItems.slice(i, i + 2));
    }
    return pages;
  }, [newsItems]);

  useEffect(() => {
    if (newsPageIndex >= newsPages.length) setNewsPageIndex(0);
  }, [newsPageIndex, newsPages.length]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [selectedCity, categoryFilter, pricingFilter, dateFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);
  const emptyRows = Math.max(0, pageSize - paginatedItems.length);
  const noResults = filteredItems.length === 0;

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-title">Cultural Events Dashboard V2</h1>
      <section className="last-news-card" aria-label="Last news insights">
        <div className="last-news-head">
          <h2 className="last-news-title">Last News</h2>
          <span className="last-news-pill">Live Insights</span>
        </div>
        <div className="last-news-carousel">
          <button
            type="button"
            className="last-news-nav"
            aria-label="Previous insight"
            onClick={() =>
              setNewsPageIndex((i) => (i === 0 ? newsPages.length - 1 : i - 1))
            }
          >
            &#8249;
          </button>
          <div className="last-news-window">
            <div
              className="last-news-track"
              style={{ transform: `translateX(-${newsPageIndex * 100}%)` }}
            >
              {newsPages.map((newsPage, idx) => (
                <div className="last-news-slide" key={`news-page-${idx}`}>
                  {newsPage.map((news) => (
                    <article className="last-news-item" key={news.label}>
                      <p className="last-news-label">{news.label}</p>
                      <p className="last-news-value">{news.value}</p>
                      <p className="last-news-sub">{news.sub}</p>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="last-news-nav"
            aria-label="Next insight"
            onClick={() =>
              setNewsPageIndex((i) => (i + 1) % (newsPages.length || 1))
            }
          >
            &#8250;
          </button>
        </div>
        <p className="last-news-index">
          {newsPages.length ? newsPageIndex + 1 : 0} / {newsPages.length}
        </p>
      </section>

      <div className="filter-bar">
        <div className="city-search-wrap">
          <label className="filter-label filter-search">
            City:
            <input
              type="text"
              className="filter-input"
              placeholder="Type city name (e.g. Paris)"
              value={citySearch}
              onFocus={() => setShowCitySuggestions(true)}
              onBlur={() => setTimeout(() => setShowCitySuggestions(false), 120)}
              onChange={(e) => {
                setCitySearch(e.target.value);
                setShowCitySuggestions(true);
                if (e.target.value.trim() === "") setSelectedCity("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyCityFilter(citySearch);
                  setShowCitySuggestions(false);
                }
              }}
            />
          </label>
          {showCitySuggestions && citySuggestions.length > 0 && (
            <ul className="city-suggestions" role="listbox">
              {citySuggestions.map((city) => (
                <li key={city}>
                  <button
                    type="button"
                    className="city-suggestion-btn"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCitySearch(city);
                      setSelectedCity(city);
                      setShowCitySuggestions(false);
                    }}
                  >
                    {city}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="filter-label">
          Category:
          <select
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-label">
          Pricing:
          <select
            className="filter-select"
            value={pricingFilter}
            onChange={(e) => setPricingFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>

        <label className="filter-label">
          Date:
          <select
            className="filter-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>

        <button
          className="page-btn filter-reset-btn"
          aria-label="Reset filters"
          title="Reset filters"
          onClick={() => {
            setCitySearch("");
            setSelectedCity("");
            setCategoryFilter("");
            setPricingFilter("");
            setDateFilter("");
          }}
        />

        <span className="filter-count">
          {filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="table-shell">
        <table className="events-table">
          <thead>
            <tr className="table-header-row">
              <th className="col-title">Title</th>
              <th className="col-date">Schedule</th>
              <th className="col-city">City</th>
              <th className="col-country">Type</th>
              <th className="col-category">Pricing</th>
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
                  <span className="cell-text">{formatDate(item.starts_at || item.event_date)}</span>
                </td>
                <td className="event-cell">
                  <span className="cell-text">{item.city || "-"}</span>
                </td>
                <td className="event-cell event-category-cell">
                  <span className="cell-text">{item.category_label || item.category || "-"}</span>
                </td>
                <td className="event-cell">
                  <span className="cell-text">{formatPricing(item)}</span>
                </td>
                <td className="event-cell">
                  <button className="event-info-btn" onClick={() => setSelectedEvent(item)}>
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
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)} role="presentation">
          <div
            className="event-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-modal-title"
          >
            <h2 id="event-modal-title">{selectedEvent.title || "Untitled event"}</h2>
            <p>
              <strong>Type:</strong> {selectedEvent.category_label || selectedEvent.category || "-"}
            </p>
            <p>
              <strong>Schedule:</strong> {formatDate(selectedEvent.starts_at || selectedEvent.event_date)}
            </p>
            <p>
              <strong>Ends at:</strong> {formatDate(selectedEvent.ends_at)}
            </p>
            <p>
              <strong>City:</strong> {selectedEvent.city || "-"}
            </p>
            <p>
              <strong>Country:</strong> {selectedEvent.country || "-"}
            </p>
            <p>
              <strong>Pricing:</strong> {formatPricing(selectedEvent)}
            </p>
            <p>
              <strong>Description:</strong> {selectedEvent.description || "-"}
            </p>
            <button className="event-info-btn modal-close-btn" onClick={() => setSelectedEvent(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
