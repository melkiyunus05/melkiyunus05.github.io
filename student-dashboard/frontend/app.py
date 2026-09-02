"""Streamlit frontend for the Personal Student Dashboard.

Step 3: base layout and navigation only. Pages are placeholders — API
wiring to the FastAPI backend happens in Step 4.
"""

import streamlit as st

st.set_page_config(
    page_title="Personal Student Dashboard",
    page_icon="🎓",
    layout="wide",
)

PAGES = [
    "Dashboard (Home)",
    "Schedule & Tasks",
    "Competitions",
    "Finances",
    "Class Notes",
]


def render_dashboard() -> None:
    st.title("🎓 Dashboard")
    st.caption("Your daily command center.")

    col1, col2, col3 = st.columns(3)

    with col1:
        st.subheader("📅 Today's Agenda")
        st.markdown("**🧑‍🎓 Classes I Attend**")
        with st.container(border=True):
            st.info("Placeholder — classes you attend today will appear here.")
        st.markdown("**🧑‍🏫 Sessions I Teach**")
        with st.container(border=True):
            st.info("Placeholder — TA sessions you teach today will appear here.")

    with col2:
        st.subheader("⏰ Urgent Deadlines")
        st.caption("Tasks and competition milestones due in the next 3–5 days.")
        with st.container(border=True):
            st.warning("Placeholder — upcoming tasks and milestones will appear here.")

    with col3:
        st.subheader("💸 Quick Financial Glance")
        st.caption("Today's expenses at a glance.")
        with st.container(border=True):
            st.metric(label="Spent Today", value="Rp 0", delta=None)
            st.info("Placeholder — today's expense breakdown will appear here.")


def render_schedule_and_tasks() -> None:
    st.title("📅 Schedule & Tasks")
    st.header("Weekly Schedule")
    with st.container(border=True):
        st.write("Placeholder — your weekly class schedule will be listed here.")

    st.header("Tasks")
    with st.container(border=True):
        st.write("Placeholder — assignments, exams, and personal to-dos will be listed here.")


def render_competitions() -> None:
    st.title("🏆 Competitions")
    st.header("Active Competitions")
    with st.container(border=True):
        st.write("Placeholder — your tracked competitions will be listed here.")

    st.header("Milestones")
    with st.container(border=True):
        st.write("Placeholder — milestones for a selected competition will appear here.")


def render_finances() -> None:
    st.title("💰 Finances")
    st.header("Monthly Summary")
    with st.container(border=True):
        st.write("Placeholder — income/expense totals for the current month will appear here.")

    st.header("Transactions")
    with st.container(border=True):
        st.write("Placeholder — the list of income/expense entries will appear here.")


def render_class_notes() -> None:
    st.title("📝 Class Notes")
    st.header("Notion Notes")
    with st.container(border=True):
        st.write("Placeholder — notes synced from your Notion workspace will appear here.")


PAGE_RENDERERS = {
    "Dashboard (Home)": render_dashboard,
    "Schedule & Tasks": render_schedule_and_tasks,
    "Competitions": render_competitions,
    "Finances": render_finances,
    "Class Notes": render_class_notes,
}


def main() -> None:
    st.sidebar.title("🎓 Student Dashboard")
    selected_page = st.sidebar.radio("Navigate", PAGES, label_visibility="collapsed")
    st.sidebar.divider()
    st.sidebar.caption("Backend: FastAPI + SQLite")

    PAGE_RENDERERS[selected_page]()


if __name__ == "__main__":
    main()
