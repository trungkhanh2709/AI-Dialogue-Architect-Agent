import React, { useEffect, useRef, useState } from "react";
import "../styles/chat.css";

export default function ChatUI({ messages, onClose,sessionExpired,setSessionExpired,userEmail   }) {
  const chatRef = useRef(null);
  const [timer, setTimer] = useState({ minutes: 0, seconds: 0 });
  const VITE_URL_BACKEND = import.meta.env.VITE_URL_BACKEND;
  const VITE_URL_BACKEND_RBAI = import.meta.env.VITE_URL_BACKEND_RBAI;

  useEffect(() => {
    if (chatRef.current) {
      const lastAgent = chatRef.current.querySelector(".chat-message.agent:last-child");
      if (lastAgent) {
        const timerHeight = document.querySelector(".timer-container")?.offsetHeight || 0;
        const margin = 10;
        chatRef.current.scrollTop = lastAgent.offsetTop - timerHeight - margin;
      }
    }
  }, [messages]);


  const handleCheckout = (plan) => {
    const url = `${VITE_URL_BACKEND_RBAI}/pay/create-checkout-session?email=${encodeURIComponent(
      userEmail
    )}&env=rsai&plan=${plan}`;
    window.open(url, "_blank");
  };

  useEffect(() => {
    // Bật timer khi component mount
    chrome.runtime.sendMessage({ type: "START_TIMER" });

    // Listener cập nhật timer
    const listener = (msg) => {
      if (msg.type === "TIMER_UPDATE") {
        setTimer(msg.payload);
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // Lấy timer hiện tại nếu reload
    chrome.runtime.sendMessage({ type: "GET_TIMER" }, (res) => {
      if (res) setTimer(res);
    });

    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);
  return (
    <div className="chat-ui">
      <div className="timer-container">
        {/* trái */}
        <div className="timer-and-text">
          <div className="record-button">
            <div className="outer-circle"></div>
            <div className="inner-circle"></div>
          </div>
          <div className="digital-timer">
            <span className="mm">{timer.minutes.toString().padStart(2, "0")}</span>
            <span className={`colon ${timer.seconds % 2 === 0 ? "" : "off"}`}>:</span>
            <span className="ss">{timer.seconds.toString().padStart(2, "0")}</span>
          </div>
        </div>

        {/* giữa */}
        <p className="agent-text">AI Dialogue Architect Agent</p>

        {/* phải */}
        <button className="close-btn" onClick={onClose}>
          <span className="line line1"></span>
          <span className="line line2"></span>
        </button>
      </div>
      <div className="chat-container" ref={chatRef}>





        {messages.map((msg, i) => (
          <div
            className={`chat-message ${msg.isAgent ? "agent" : "user"} ${msg.isTemp ? "typing" : ""}`}
            key={i}
          >
            {!msg.isAgent && <b>{msg.speaker}:</b>}{" "}
            {msg.isSpeaking ? (
              <span className="typing-container">
                <span className="typing-text">speaking</span>
                <span className="typing-dots">
                  <span></span><span></span><span></span>
                </span>
              </span>
            ) : msg.isTemp ? (
              <span className="typing-container">
                <span className="typing-text">Agent is responding </span>
                <span className="typing-dots">
                  <span></span><span></span><span></span>
                </span>
              </span>
            ) : (
              msg.text
            )}
          </div>
        ))}
      </div>
{sessionExpired && (
  <div className="popup-overlay">
    <div className="popup-content">
      <h2>Your session has ended!</h2>
      <p>Choose a package to continue using the assistant.</p>
      <div className="button-group">
        <button
                className="upgrade-btn one-session"
                onClick={() =>
                  handleCheckout("addons_ai_dialogue_architect_agent_single")
                }
              >
                Buy 1 Session
              </button>
              <button
                className="upgrade-btn ten-session"
                onClick={() =>
                  handleCheckout("addons_ai_dialogue_architect_agent_bundle")
                }
              >
                Buy 10 Sessions
              </button>
      </div>
      <div className="continue-wrapper">
        <span
         className="continue-text"
         onClick={async () => {
           try {
             const res = await fetch(`${VITE_URL_BACKEND}/api/addons/use_addon_session`, {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                 email: userEmail,
                 add_on_type: "ai_dialogue_architect_agent"
               })
             });
             const data = await res.json();
             if (data.trial_used === true || data.status === "200") {
               chrome.runtime.sendMessage({ type: "RESET_TIMER" }, () => {
                 chrome.runtime.sendMessage({ type: "START_TIMER" });
               });
                // reload lại UI, popup biến mất, tiếp tục call
                setSessionExpired(false);
             } else {
               alert("You ran out of sessions. Please buy more to continue.");
             }
           } catch (err) {
            console.error(err);
             alert("Error when using session.");
           }
         }}
       >
         Continue to the Call
       </span>

      </div>
    </div>
  </div>
)}

    </div>
  );
}
