import React, { useEffect, useState } from "react";
// import "../styles/upgradePopup.css";

const UpgradePopup = ({ onClose, userEmail, onContinue }) => {
  const VITE_URL_BACKEND = "https://api-as.reelsightsai.com";
  const VITE_URL_BACKEND_RBAI = "https://api.reelsightsai.com";
  const decodedCookieEmail = decodeURIComponent(userEmail);
  const [canContinue, setCanContinue] = useState(false);


    useEffect(() => {
    if (!decodedCookieEmail) return;

    chrome.runtime.sendMessage(
      {
        type: "GET_REMAIN_SESSIONS",
        payload: {
          email: decodedCookieEmail,
          add_on_type: "ai_dialogue_architect_agent",
        },
      },
      (res) => {
        if (res?.error || !res?.data?.content) {
          setCanContinue(false);
          return;
        }

        const { value, trial } = res.data.content;

        // value = số session, trial = có trial hay không
        // tuỳ logic bên server, nhưng thường:
        // - còn value > 0 hoặc có trial => cho continue
        setCanContinue((value ?? 0) > 0 || !!trial);
      }
    );
  }, [decodedCookieEmail]);

  const handleCheckout = (plan) => {
    const url = `${VITE_URL_BACKEND_RBAI}/pay/create-checkout-session?email=${encodeURIComponent(
      userEmail
    )}&env=rsai&plan=${plan}`;
    window.open(url, "_blank");
  };
  const handleContinue = () => {
    if (!decodedCookieEmail) {
      alert("Missing user email");
      return;
    }

    // 1) Trừ thêm 1 session trên server
    chrome.runtime.sendMessage(
      {
        type: "USE_ADDON_SESSION",
        payload: {
          email: decodedCookieEmail,
          add_on_type: "ai_dialogue_architect_agent",
        },
      },
      (res) => {
        if (!res || res.error || !res.data) {
          console.error("USE_ADDON_SESSION error:", res?.error);
          alert("An error occurred while calling the API");
          return;
        }

        const data = res.data;
        const ok = data?.trial_used === true || data?.status === "200";

        if (!ok) {
          alert(
            "You have run out of sessions. Please purchase an add-on to continue."
          );
          return;
        }

        // 2) Reset & start lại timer (giống như lúc bấm Start lần đầu)
        chrome.runtime.sendMessage({ type: "RESET_TIMER" }, () => {
          chrome.runtime.sendMessage({ type: "START_TIMER" });
        });

        // 3) Gọi callback từ App để quay lại màn Meeting
        if (typeof onContinue === "function") {
          onContinue();
        }
      }
    );
  };

  return (
    <div className="upgrade-popup-overlay">
      <div className="upgrade-popup-card">
        <button className="close-btn-upgrade" onClick={onClose}>
          ✕
        </button>
        <h2 className="headline">
          Limited Time: 10% Off. Smarter Conversations, Faster Closings.
        </h2>
        <p className="body-text">
          You’ve seen the <strong>AI Dialogue Architect Agent</strong> in
          action—delivering hyper-personalized responses that move deals
          forward. Now unlock full access to real-time objection handling,
          persona matching, and scalable outreach.
        </p>
        <p className="body-text">
          Powered by the calm precision of Dr. Huang and the bold persuasion of
          Alex Hormozi, this agent doesn’t just respond—it{" "}
          <strong>architects the conversation</strong>.
        </p>
        <p className="body-text">
          Upgrade now and let your agent do the heavy lifting while you stay in
          control. Use code <span className="code">ARCHITECT10</span> at
          checkout for 10% off your first purchase.
        </p>
       {canContinue && (
        <button
          className="upgrade-btn single"
          onClick={handleContinue}
        >
          Continue this meeting (use 1 session)
        </button>
      )}
        <div className="pricing">
          <h3 className="pricing-title">Pricing</h3>
          <table className="pricing-table">
            <thead className="pricing-head">
              <tr style={{ backgroundColor: "white" }}>
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
          <button
            className="upgrade-btn single"
            onClick={() =>
              handleCheckout("addons_ai_dialogue_architect_agent_single")
            }
          >
            Get 1x Use – $500
          </button>

          <button
            className="upgrade-btn bundle"
            onClick={() =>
              handleCheckout("addons_ai_dialogue_architect_agent_bundle")
            }
          >
            Get 10x Uses – $4,000
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradePopup;
