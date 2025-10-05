//meetingpage.jsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
// import "../styles/meeting.css";
import ChatUI from "../component/ChatUI";
import SaveConfirmPopup from "../component/SaveConfirmPopup";


export default function Meeting({ meetingData, onBack, cookieUserName, onExpire }) {
  const VITE_URL_BACKEND = 'https://api-as.reelsightsai.com'
  // const VITE_URL_BACKEND = 'http://localhost:4000'


  const [currentSpeech, setCurrentSpeech] = useState({});
  const [meetingLog, setMeetingLog] = useState([]);
  const [lastFinalizedWords, setLastFinalizedWords] = useState({});
  const liveRef = useRef(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState({});
  const [chatHistory, setChatHistory] = useState([]);
  const [chatMessages, setChatMessages] = useState([
    {
      speaker: "Agent",
      text: "Hello, I’m your AI Sales Assistant. I can help you interact with your customers more effectively.",
      isAgent: true,
      isTemp: false,
    },
  ]);
  const [agentTyping, setAgentTyping] = useState(false);

  const decodedCookieEmail = decodeURIComponent(cookieUserName);
  const [showSavePopup, setShowSavePopup] = useState(false);


  function isMySpeech(speaker) {
    return speaker === "You" || speaker === "Bạn";
  }

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [currentSpeech]);

  useEffect(() => {
    if (sessionExpired) {
      onExpire(); // báo cho App.jsx đổi sang upgrade
    }
  }, [sessionExpired, onExpire]);
  // Listener chrome message
  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === "SESSION_EXPIRED") {
        setSessionExpired(true);
        return; // dừng luôn, khỏi chạy tiếp
      }

      if (message.type !== "LIVE_TRANSCRIPT") return;

      const { action, speaker, finalized, currentSpeech: liveSpeech } = message.payload;

      // --- Update live speech ---
      if (action === "update_live" && liveSpeech) {
        setCurrentSpeech((prev) => {
          const updated = { ...prev };
          Object.entries(liveSpeech).forEach(([spk, text]) => {
            const deltaText = getDeltaText(spk, text);
            if (deltaText) updated[spk] = deltaText;

            if (!isMySpeech(spk)) {
              setSpeakingUsers(prev => ({ ...prev, [spk]: true }));
            }
          });
          return updated;
        });
      }

      // --- Handle finalize ---
      if (action === "finalize" && finalized) {
        setMeetingLog((prev) => {
          const newLogEntry = `${speaker}: "${finalized}"`;
          if (prev.includes(newLogEntry)) return prev;

          const updatedLog = [...prev, newLogEntry];

          // chỉ gửi agent nếu session chưa hết hạn
          if (!sessionExpired && !isMySpeech(speaker)) {
            setChatMessages((prevMsgs) => [...prevMsgs, { speaker, text: finalized }]);
            setSpeakingUsers(prev => ({ ...prev, [speaker]: false }));
            sendMessageToAgent({ speaker, text: finalized }, updatedLog);
          }

          return updatedLog;
        });

        setCurrentSpeech((prev) => {
          const updated = { ...prev };
          delete updated[speaker];
          return updated;
        });

        setLastFinalizedWords((prev) => ({
          ...prev,
          [speaker]: [...(prev[speaker] || []), ...finalized.split(/\s+/)],
        }));
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [sessionExpired]);



  useEffect(() => {
    const finder = setInterval(() => {
      const container = document.querySelector("div.nMcdL.bj4p3b")
        ?.parentElement?.parentElement;
      if (container) {
        initObserver(container);
        clearInterval(finder);
      }
    }, 300);

    return () => clearInterval(finder);
  }, []);

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [currentSpeech, meetingLog]);



  const sendMessageToAgent = async (newMessage, log) => {
    if (sessionExpired) return; // chặn gửi nếu hết hạn
    try {
      setAgentTyping(true);

      setChatMessages((prev) => [
        ...prev,
        { speaker: "Agent", text: "The agent is responding...", isAgent: true, isTemp: true },
      ]);

      const payload = {
        userName: meetingData.userName,
        userCompanyName: meetingData.userCompanyName,
        userCompanyServices: meetingData.userCompanyServices,
        prospectName: meetingData.prospectName,
        customerCompanyName: meetingData.customerCompanyName,
        customerCompanyServices: meetingData.customerCompanyServices,
        meetingGoal: meetingData.meetingGoal,
        meetingEmail: meetingData.meetingEmail,
        meetingMessage: meetingData.meetingMessage,
        meetingNote: meetingData.meetingNote,
        meetingLog: log.join("\n"),
        msg: chatHistory,
      };

      const res = await axios.post(
        `${VITE_URL_BACKEND}/api/content-generators/ai_dialogue_architect_agent`,
        payload
      );

      if (res.data.status === 200) {
        const agentText = res.data.content;

        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.isTemp ? { ...msg, text: agentText, isTemp: false } : msg
          )
        );
        setChatHistory(res.data.msg);
      }
    } catch (err) {
      console.error("Send to agent failed:", err);
      setChatMessages((prev) => {
        return prev.map((msg) =>
          msg.isTemp ? { ...msg, text: "Agent is unable to respond 😢", isTemp: false } : msg
        );
      });
    } finally {
      setAgentTyping(false);
    }
  };



  const handleClose = () => {

    const autoSaveEnabled = localStorage.getItem("autoSaveEnabled") === "true";
    const alreadyConfirmed = localStorage.getItem("saveConfirmed");

    if (autoSaveEnabled) {
      saveMeetingData();
      onBack();
      return;
    }

    if (alreadyConfirmed === "true") {
      saveMeetingData();
      onBack();
    } else {
      setShowSavePopup(true);
    }
  };
  const saveMeetingData = async () => {
    try {
      const meetingId =
        (meetingData._id && meetingData._id.$oid) ||
        meetingData._id ||
        meetingData.id;

      if (!meetingId) {
        console.error("Missing meetingId in meetingData", meetingData);
        return;
      }

      const payloadMeeting = {
        ...meetingData,
        meeting_transcript: meetingLog.join("\n"), // thêm transcript vào payload
      };
      console.log("meetingId", meetingId);
      const res = await fetch(
        `${VITE_URL_BACKEND}/api/meeting_prepare/update_meeting_prepare/${encodeURIComponent(decodedCookieEmail)}/${meetingId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetings: [payloadMeeting] }),
        }
      );

      if (!res.ok) throw new Error("Save meeting failed");

      console.log("Meeting saved with transcript");
    } catch (err) {
      console.error("Save failed", err);
    }
  };


  const handleConfirmSave = () => {
    saveMeetingData();
    localStorage.setItem("saveConfirmed", "true");
    localStorage.setItem("autoSaveEnabled", "true"); // thêm dòng này

    setShowSavePopup(false);
    onBack();
  };

  const handleCancelSave = () => {
    localStorage.setItem("saveConfirmed", "false");
    setShowSavePopup(false);
    onBack();
  };


  // // //nhớ lên prodS thì xoá
  // useEffect(() => {
  //   localStorage.removeItem("saveConfirmed");
  // }, []);




  return (
    <div className="meeting-wrapper">
      {/* Delete duplicate rendering */}
      <div
        className="meeting-log-container"
      >
        {meetingLog.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>

      <div ref={liveRef}>
        {Object.entries(currentSpeech).map(([speaker, text]) => {
          const deltaText = getDeltaText(speaker, text);
          return deltaText ? (
            <div key={speaker}>
              <b>{speaker}:</b> {deltaText}
            </div>
          ) : null;
        })}
      </div>

      {/* <ChatUI messages={sampleMessages} /> */}
      <ChatUI messages={chatMessages}
        onClose={handleClose}
        sessionExpired={sessionExpired}
        setSessionExpired={setSessionExpired}
        userEmail={decodedCookieEmail} />

      {showSavePopup && (
        <SaveConfirmPopup
          onConfirm={handleConfirmSave}
          onCancel={handleCancelSave}
        />
      )}
    </div>
  );
}
