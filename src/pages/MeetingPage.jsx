//meetingpage.jsx
import React, { useEffect, useState, useRef } from "react";
import "../styles/meeting.css";
import ChatUI from "../component/ChatUI";
import axios from "axios";


export default function Meeting({ meetingData, onBack, cookieUserName,onExpire  }) {
  const VITE_URL_BACKEND = 'https://api-as.reelsightsai.com'

  
  const [currentSpeech, setCurrentSpeech] = useState({});
  const [meetingLog, setMeetingLog] = useState([]);
  const [lastFinalizedWords, setLastFinalizedWords] = useState({});
  const [summary, setSummary] = useState("(The summary will appear here)");
  const speakerTimers = useRef({});
  const liveRef = useRef(null);
  const [liveStreamText, setLiveStreamText] = useState({});
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
  const sampleMessages = [
    { speaker: "You", text: "Hi Agent!", isAgent: false },
    { speaker: "Agent", text: "Hello! I'm here to help with your questions.", isAgent: true },
    { speaker: "You", text: "Can you help me with my project?", isAgent: false },
    { speaker: "Agent", text: "Sure! Let's start.", isAgent: true },
    { speaker: "You", text: "Can you help me with my project?", isAgent: false },
    { speaker: "You", text: "Can you help me with my project?", isAgent: false },
    { speaker: "You", text: "Can you help me with my project?", isAgent: false },
    { speaker: "You", text: "Can you help me with my project?", isAgent: false },
    { speaker: "You", text: "Can you help me with my project?", isAgent: false },
  ];
  const decodedCookieEmail = decodeURIComponent(cookieUserName);



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
        onClose={onBack} sessionExpired={sessionExpired} 
        setSessionExpired={setSessionExpired}  
        userEmail={decodedCookieEmail}/>
    </div>
  );
}
