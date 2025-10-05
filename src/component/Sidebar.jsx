import React, { useState } from "react";
// import "../styles/sidebar.css";

export default function Sidebar({ blocks, onViewBlock, onEditBlock, onDeleteBlock, onCreateNew,setSidebarVisible  }) {
  const [search, setSearch] = useState("");
  const [expandedBlockId, setExpandedBlockId] = useState(null);

  const filteredBlocks = blocks.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpand = (blockId) => {
    setExpandedBlockId(expandedBlockId === blockId ? null : blockId);
  };

  // helper để auto collapse sau khi click 1 action
  const collapseAfterAction = (action) => {
    action();
    setExpandedBlockId(null);
     setSidebarVisible(false); 
  };

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
        <div className="sidebar-item new-block" onClick={() => {
            onCreateNew();
            setSidebarVisible(false); // hide khi tạo mới
          }}>
          + Create New
        </div>

        {filteredBlocks.map((block) => {
          const isExpanded = expandedBlockId === block.id;
          return (
            <div key={block.id} className={`sidebar-item ${isExpanded ? "expanded" : ""}`}>
              <div className="block-header" onClick={() => toggleExpand(block.id)}>
                {block.name}
              </div>

              {isExpanded && (
                <div className="block-actions-vertical">
                  <button
                    className="view-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      collapseAfterAction(() => onViewBlock(block));
                    }}
                  >
                    View
                  </button>
                  <button
                    className="update-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      collapseAfterAction(() => onEditBlock(block));
                    }}
                  >
                    Update
                  </button>
                  <button
                    className="delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      collapseAfterAction(() => onDeleteBlock(block));
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredBlocks.length === 0 && (
          <div className="sidebar-empty">No blocks found</div>
        )}
      </div>
    </div>
  );
}
