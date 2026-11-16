import streamlit as st
import brain

st.set_page_config(page_title="Emilly", page_icon="✦")
st.title("Emilly ✦")

name = st.sidebar.text_input("Mau dipanggil apa?", "")

if "turns" not in st.session_state:
    st.session_state.turns = []

for t in st.session_state.turns:
    with st.chat_message(t["role"]):
        st.write(t["content"])

if msg := st.chat_input("Ketik pesan..."):
    st.session_state.turns.append({"role": "user", "content": msg})
    with st.chat_message("user"):
        st.write(msg)

    out = brain.reply(st.session_state.turns, name)

    st.session_state.turns.append({"role": "assistant", "content": out})
    with st.chat_message("assistant"):
        st.write(out)