//meetingpage.jsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
// import "../styles/meeting.css";
import ChatUI from "../component/ChatUI";
import SaveConfirmPopup from "../component/SaveConfirmPopup";


export default function Meeting({ meetingData, onBack, cookieUserName, onExpire }) {
 
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

const reqIdRef = useRef(0); 
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


const saveOrUpdateMeeting = (logData) => {
  const autoSaveEnabled = localStorage.getItem("autoSaveEnabled") === "true";
  if (!autoSaveEnabled) return;

  const transcriptText = Array.isArray(logData) ? logData.join("\n") : meetingLog.join("\n");

  if (!meetingData._id && !meetingData.id) {
    // chưa có ID => tạo mới
    const newBlockPayload = {
      ...meetingData,
      blockName: meetingData.title || "Untitled Meeting",
      meeting_transcript: transcriptText,
      createdAt: new Date().toISOString(),
    };

    console.log("[AUTO SAVE] Creating new meeting with transcript:", transcriptText);

    chrome.runtime.sendMessage(
      {
        type: "CREATE_MEETING_PREPARE",
        payload: { email: decodedCookieEmail, payload: newBlockPayload },
      },
      (res) => {
        console.log("[CREATE_MEETING_PREPARE] response:", res);
        if (res?.error) console.error("Create block failed:", res.error);
        else console.log("Created new block with transcript:", res.data);
      }
    );
    return;
  }

  // đã có ID => update
  const meetingId = meetingData._id || meetingData.id;
  if (!meetingId) {
    console.error("meetingId missing even though _id/id exists", meetingData);
    return;
  }

  const payloadMeeting = {
    ...meetingData,
    meeting_transcript: transcriptText,
  };

  console.log("[AUTO SAVE UPDATE] meetingId:", meetingId);
  console.log("[AUTO SAVE UPDATE] payload:", payloadMeeting);

  chrome.runtime.sendMessage(
    {
      type: "SAVE_MEETING_TRANSCRIPT",
      payload: { email: decodedCookieEmail, meetingId, payloadMeeting },
    },
    (res) => {
      console.log("[SAVE_MEETING_TRANSCRIPT] response:", res);
      if (res?.error) console.error("Save failed:", res.error);
      else console.log("Meeting updated with transcript", res.data);
    }
  );
};

const meetingLogRef = useRef(meetingLog);
useEffect(() => {
  meetingLogRef.current = meetingLog;
}, [meetingLog]);


  // Listener chrome message
  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === "SESSION_EXPIRED") {
        const autoSaveEnabled = localStorage.getItem("autoSaveEnabled") === "true";

        if (autoSaveEnabled) {
          saveOrUpdateMeeting(meetingLogRef.current); // tự động lưu/update
          onExpire();            // chuyển sang upgrade
        } else {
          setShowSavePopup(true); // hiện popup
        }

        setSessionExpired(true);
        return;
      }

        if (message.type === "AGENT_STREAM_START") {
      // optional: có thể set trạng thái gì đó
      return;
    }

if (message.type === "AGENT_STREAM_CHUNK") {
  const { delta, requestId } = message.payload || {};
  if (!delta) return;

  setChatMessages((prev) => {
    const m = [...prev];
    for (let i = m.length - 1; i >= 0; i--) {
      if (m[i].isAgent && m[i].isTemp && m[i].requestId === requestId) {
        m[i] = {
          ...m[i],
          text: (m[i].text || "") + delta,
        };
        break;
      }
    }
    return m;
  });
  return;
}
if (message.type === "AGENT_STREAM_DONE") {
  const { requestId } = message.payload || {};
  setAgentTyping(false);
  setChatMessages((prev) => {
    const newArr = [...prev];
    for (let i = newArr.length - 1; i >= 0; i--) {
      if (newArr[i].isAgent && newArr[i].isTemp && newArr[i].requestId === requestId) {
        newArr[i] = {
          ...newArr[i],
          isTemp: false,
        };
        break;
      }
    }
    return newArr;
  });
  return;
}

if (message.type === "AGENT_STREAM_ERROR") {
  const { error, requestId } = message.payload || {};
  console.error("Agent stream error:", error);
  setAgentTyping(false);
  setChatMessages((prev) => {
    const newArr = [...prev];
    for (let i = newArr.length - 1; i >= 0; i--) {
      if (newArr[i].isAgent && newArr[i].isTemp && newArr[i].requestId === requestId) {
        newArr[i] = {
          ...newArr[i],
          text: "Agent is unable to respond 😢",
          isTemp: false,
        };
        break;
      }
    }
    return newArr;
  });
  return;
}

    // ====== END STREAM ======

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

    // 🔥 1) MỖI LẦN FINALIZE -> AUTO SAVE FULL TRANSCRIPT
    const autoSaveEnabled = localStorage.getItem("autoSaveEnabled") === "true";
    if (autoSaveEnabled) {
      // dùng helper đã viết sẵn: sẽ tự biết tạo mới hay update
      saveOrUpdateMeeting(updatedLog);
    }

    // 🔥 2) Gửi cho agent nếu session chưa hết hạn & speaker không phải "You/Bạn"
    if (!sessionExpired && !isMySpeech(speaker)) {
      setChatMessages((prevMsgs) => [
        ...prevMsgs,
        { speaker, text: finalized },
      ]);
      setSpeakingUsers((prev) => ({ ...prev, [speaker]: false }));
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


const sendMessageToAgent = (newMessage, log) => {
  if (sessionExpired) return;

  // Tạo ID duy nhất cho mỗi request
  const requestId = ++reqIdRef.current;

  // thêm message agent rỗng, isTemp = true, kèm requestId
  setChatMessages((prev) => [
    ...prev,
    {
      speaker: "Agent",
      text: "", // sẽ được fill dần từ stream
      isAgent: true,
      isTemp: true,
      requestId, // 👈 quan trọng
    },
  ]);

  setAgentTyping(true);

  chrome.runtime.sendMessage(
    {
      type: "SEND_MESSAGE_TO_AGENT_STREAM",
      payload: {
        meetingData,
        chatHistory,
        log,
        requestId, // 👈 gửi luôn sang background
      },
    },
    (res) => {
      // res chỉ báo ok/error tổng thể, stream đi qua onMessage bên dưới
      if (res?.error || res?.ok === false) {
        console.error("Agent stream start failed:", res.error);
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.isTemp && msg.isAgent && msg.requestId === requestId
              ? { ...msg, text: "Agent is unable to respond 😢", isTemp: false }
              : msg
          )
        );
        setAgentTyping(false);
      }
    }
  );
};


  const handleClose = () => {
    const autoSaveEnabled = localStorage.getItem("autoSaveEnabled") === "true";
    const alreadyConfirmed = localStorage.getItem("saveConfirmed") === "true";

    if (autoSaveEnabled) {
      if (meetingData._id || meetingData.id) {
        saveMeetingData();
        onBack();
      }

      if (!meetingData._id && !meetingData.id) {
        // Hiển thị ngay trạng thái đóng popup / quay lại
        onBack();

        // Tạo block mới bất đồng bộ
        const newBlockPayload = {
          ...meetingData,
          blockName: meetingData.title || "Untitled Meeting",
          meeting_transcript: meetingLog.join("\n"),
          createdAt: new Date().toISOString(),
        };

        chrome.runtime.sendMessage(
          {
            type: "CREATE_MEETING_PREPARE",
            payload: { email: decodedCookieEmail, payload: newBlockPayload },
          },
          (res) => {
            if (res?.error) console.error("Create block failed:", res.error);
            else console.log("Created new block with transcript:", res.data);
          }
        );

        return;
      }

      return;
    }

    // autoSave disabled và chưa confirm -> hiện popup
    setShowSavePopup(true);
  };




  const saveMeetingData = () => {
    const meetingId = meetingData._id?._id || meetingData._id || meetingData.id;


    if (!meetingId) {
      console.error("Missing meetingId in meetingData", meetingData);
      return;
    }

    const payloadMeeting = {
      ...meetingData,
      meeting_transcript: meetingLog.join("\n")
    };

    chrome.runtime.sendMessage(
      {
        type: "SAVE_MEETING_TRANSCRIPT",
        payload: {
          email: decodedCookieEmail,
          meetingId,
          payloadMeeting,
        },
      },
      (res) => {
        if (res?.error) {
          console.error("Save failed:", res.error);
        } else {
          console.log("Meeting saved with transcript", res.data);
        }
      }
    );
  };



  const handleConfirmSave = () => {
    saveMeetingData();
    localStorage.setItem("saveConfirmed", "true");
    localStorage.setItem("autoSaveEnabled", "true"); // bật switch
    setShowSavePopup(false);
    onBack();
  };

  const handleCancelSave = () => {
    localStorage.setItem("saveConfirmed", "false");
    localStorage.setItem("autoSaveEnabled", "false"); // tắt switch
    setShowSavePopup(false);
    onBack();
  };


  // // //nhớ lên prodS thì xoá




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
