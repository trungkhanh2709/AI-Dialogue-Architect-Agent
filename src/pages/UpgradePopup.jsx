import React from "react";
// import "../styles/upgradePopup.css";

const UpgradePopup = ({ onClose, userEmail }) => {
  const VITE_URL_BACKEND = 'https://api-as.reelsightsai.com';
  const VITE_URL_BACKEND_RBAI = 'https://api.reelsightsai.com';
  const handleCheckout = (plan) => {
    const url = `${VITE_URL_BACKEND_RBAI}/pay/create-checkout-session?email=${encodeURIComponent(
      userEmail
    )}&env=rsai&plan=${plan}`;
    window.open(url, "_blank");
  };

  return (
    <div className="upgrade-popup-overlay">
      <div className="upgrade-popup-card">
        <button className="close-btn-upgrade" onClick={onClose}>✕</button>
        <h2 className="headline">
          Limited Time: 10% Off. Smarter Conversations, Faster Closings.
        </h2>
        <p className="body-text">
          You’ve seen the <strong>AI Dialogue Architect Agent</strong> in action—delivering
          hyper-personalized responses that move deals forward. Now unlock full access
          to real-time objection handling, persona matching, and scalable outreach.
        </p>
        <p className="body-text">
          Powered by the calm precision of Dr. Huang and the bold persuasion of Alex
          Hormozi, this agent doesn’t just respond—it <strong>architects the conversation</strong>.
        </p>
        <p className="body-text">
          Upgrade now and let your agent do the heavy lifting while you stay in control.
          Use code <span className="code">ARCHITECT10</span> at checkout for 10% off your first purchase.
        </p>

        <div className="pricing">
          <h3 className="pricing-title">Pricing</h3>
          <table className="pricing-table">
            <thead className="pricing-head">
              <tr style={{backgroundColor: 'white'}}>
                <th className="pricing-col">Package</th>
                <th className="pricing-col">Standard Price</th>
                <th className="pricing-col">Discount</th>
                <th className="pricing-col">Final Price</th>
              </tr>
            </thead>
            <tbody className="pricing-body">
              <tr className="pricing-row">
                <td className="pricing-item">1x Use</td>
                <td className="pricing-item">$500</td>
                <td className="pricing-item">—</td>
                <td className="pricing-item">$500</td>
              </tr>
              <tr className="pricing-row highlight">
                <td className="pricing-item">10x Uses</td>
                <td className="pricing-item">$5,000</td>
                <td className="pricing-item discount">20% Off</td>
                <td className="pricing-item final-price">$4,000</td>
              </tr>
            </tbody>

          </table>
        </div>
<div className="upgrade-actions">
  <button className="upgrade-btn single"
    onClick={() =>
      handleCheckout("addons_ai_dialogue_architect_agent_single")
    }>
    Get 1x Use – $500
  </button>

  <button className="upgrade-btn bundle"
    onClick={() =>
      handleCheckout("addons_ai_dialogue_architect_agent_bundle")
    }>
    Get 10x Uses – $4,000
  </button>
</div>

      </div>
    </div>
  );
};

export default UpgradePopup;
