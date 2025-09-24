import React, { useState, useEffect } from "react";
import "../styles/sidebar.css";

export default function Sidebar({ blocks, onSelectBlock, onCreateNew }) {
  const [search, setSearch] = useState("");
  const filteredBlocks = blocks.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="sidebar-container">
      <input
        type="text"
        placeholder="Search blocks..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="sidebar-search"
      />

      <div className="sidebar-list">
        <div className="sidebar-item new-block" onClick={onCreateNew}>
          + Create New
        </div>

        {filteredBlocks.map((block) => (
          <div
            key={block.id}
            className="sidebar-item"
            onClick={() => onSelectBlock(block)}
          >
            {block.name}
          </div>
        ))}

        {filteredBlocks.length === 0 && (
          <div className="sidebar-empty">No blocks found</div>
        )}
      </div>
    </div>
  );
}

