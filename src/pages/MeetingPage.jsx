import React, { useEffect, useState, useRef } from "react";
import "../styles/meeting.css";
import ChatUI from "../component/ChatUI";
import axios from "axios";

export default function Meeting({ meetingData, onBack }) {
  const [currentSpeech, setCurrentSpeech] = useState({});
  const [meetingLog, setMeetingLog] = useState([]);
  const [lastFinalizedWords, setLastFinalizedWords] = useState({});
  const [summary, setSummary] = useState("(The summary will appear here)");
  const speakerTimers = useRef({});
  const liveRef = useRef(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [myName, setMyName] = useState("You");



  function isMySpeech(speaker) {

    return speaker === "You" || speaker === "Bạn";
  }

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [currentSpeech]);

  // Listener chrome message




  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type !== "LIVE_TRANSCRIPT") return;
      const { action, speaker, finalized, currentSpeech: liveSpeech } = message.payload;

      if (action === "update_live" && liveSpeech) {
        setCurrentSpeech(prev => {
          // loại bỏ phần duplicate với lastFinalizedWords
          const updated = { ...prev };
          Object.entries(liveSpeech).forEach(([spk, text]) => {
            const deltaText = getDeltaText(spk, text);
            if (deltaText) updated[spk] = deltaText;
          });
          return updated;
        });
      }

      if (action === "finalize" && finalized) {
        setMeetingLog(prev => {
          // tránh duplicate
              if (prev.some(l => l === `${speaker}: "${finalized}"`)) return prev;
    const newLog = [...prev, `${speaker}: "${finalized}"`];

          
        });

        if (!isMySpeech(speaker)) {
          const newMsg = { speaker, text: finalized, isMe: false };
          setChatMessages(prev => {
            const exists = prev.some(msg => msg.speaker === speaker && msg.text === finalized);
            if (exists) return prev;
            return [...prev, newMsg];
          });

          // gửi request cho server AI
          sendMessageToAgent({ speaker, text: finalized });
        }

        // Xóa live của speaker đã finalize
        setCurrentSpeech(prev => {
          const updated = { ...prev };
          delete updated[speaker];
          return updated;
        });

        // Cập nhật lastFinalizedWords React state luôn
        setLastFinalizedWords(prev => ({
          ...prev,
          [speaker]: [...(prev[speaker] || []), ...finalized.split(/\s+/)]
        }));
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);



  useEffect(() => {
    const finder = setInterval(() => {
      const container = document.querySelector("div.nMcdL.bj4p3b")
        ?.parentElement?.parentElement;
      if (container) {
        initObserver(container);
        clearInterval(finder);
      }
    }, 300);

    console.log("⏳ Waiting for caption container...");
    return () => clearInterval(finder);
  }, []);

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [currentSpeech, meetingLog]);



  const sendMessageToAgent = async (newMessage) => {
    try {
        console.log("===== Current meetingLog =====");
    console.log(meetingLog);
    console.log("===== End of meetingLog =====");
      // Tạo payload
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
        meetingLog: meetingLog.join("\n")
      };
      console.log("meetingLog", meetingLog)
      const res = await axios.post(
        "http://127.0.0.1:8000/api/content-generators/ai_sales_agent1",
        payload
      );

      if (res.data.status === 200) {
        // Lấy response agent
        const agentText = res.data.content;

        // Thêm vào chat UI bên phải
        setChatMessages(prev => [
          ...prev,
          { speaker: "Agent", text: agentText, isMe: false, isAgent: true }
        ]);
      }
    } catch (err) {
      console.error("Send to agent failed:", err);
    }
  };



  return (
    <div>


      <h3>Sale Agent</h3>

      {/* Delete duplicate rendering */}
      <div style={{ fontWeight: "bold", marginTop: 8, marginBottom: 4 }}>
        Meeting Log:
      </div>
      <div
        style={{
          maxHeight: 150,
          overflowY: "auto",
          border: "1px solid #ccc",
          padding: 5,
          background: "#fafafa",
        }}
      >
        {meetingLog.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>


      <div style={{ fontWeight: "bold", marginTop: 8, marginBottom: 4 }}>
        Live Caption:
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



      <h3>Chat (Live)</h3>
      <ChatUI messages={chatMessages} />


    </div>
  );
}