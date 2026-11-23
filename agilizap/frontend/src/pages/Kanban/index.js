import React, { useState, useEffect, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import Board from "react-trello";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import { useHistory } from "react-router-dom";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

const useStyles = makeStyles((theme) => ({
  boardWrapper: {
    flex: 1,
    overflowX: "auto",
    overflowY: "hidden",
    borderRadius: 14,
    backgroundColor: "var(--bg-subtle)",
    border: "1px solid var(--border-hairline)",
    padding: theme.spacing(1.5),
    ...theme.scrollbarStyles,
  },
  cardBody: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 4,
  },
  cardPhone: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    color: "var(--ink-muted)",
    margin: 0,
  },
  cardMsg: {
    fontSize: "0.8125rem",
    color: "var(--ink-secondary)",
    lineHeight: 1.4,
    margin: 0,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  button: {
    backgroundColor: "var(--action)",
    border: "none",
    padding: "7px 12px",
    color: "var(--action-ink)",
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    fontSize: "0.78rem",
    borderRadius: 8,
    cursor: "pointer",
    alignSelf: "flex-start",
    transition: "background-color var(--t-in) var(--ease-ui)",
    "&:hover": {
      backgroundColor: "var(--action-hover)",
    },
  },
}));

const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();

  const [tags, setTags] = useState([]);
  const [reloadData] = useState(false);

  const fetchTags = async () => {
    try {
      const response = await api.get("/tags/kanban");
      const fetchedTags = response.data.lista || [];
      setTags(fetchedTags);
      await fetchTickets(jsonString);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    fetchTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [file, setFile] = useState({
    lanes: [],
  });

  const [tickets, setTickets] = useState([]);
  const { user } = useContext(AuthContext);
  const jsonString = user.queues.map((queue) => queue.UserQueue.queueId);

  const fetchTickets = async (queueIdsArg) => {
    try {
      const { data } = await api.get("/ticket/kanban", {
        params: {
          queueIds: JSON.stringify(queueIdsArg),
          teste: true,
        },
      });
      setTickets(data.tickets);
    } catch (err) {
      console.log(err);
      setTickets([]);
    }
  };

  const handleCardClick = (uuid) => {
    history.push("/tickets/" + uuid);
  };

  const popularCards = () => {
    const filteredTickets = tickets.filter((ticket) => ticket.tags.length === 0);

    const lanes = [
      {
        id: "lane0",
        title: i18n.t("Em aberto"),
        label: String(filteredTickets.length),
        cards: filteredTickets.map((ticket) => ({
          id: ticket.id.toString(),
          label: `#${ticket.id}`,
          description: (
            <div className={classes.cardBody}>
              <p className={classes.cardPhone}>{ticket.contact.number}</p>
              {ticket.lastMessage && (
                <p className={classes.cardMsg}>{ticket.lastMessage}</p>
              )}
              <button
                type="button"
                className={classes.button}
                onClick={() => handleCardClick(ticket.uuid)}
              >
                Ver Ticket
              </button>
            </div>
          ),
          title: ticket.contact.name,
          draggable: true,
          href: "/tickets/" + ticket.uuid,
        })),
      },
      ...tags.map((tag) => {
        const laneTickets = tickets.filter((ticket) => {
          const tagIds = ticket.tags.map((t) => t.id);
          return tagIds.includes(tag.id);
        });

        return {
          id: tag.id.toString(),
          title: tag.name,
          label: String(laneTickets.length),
          cards: laneTickets.map((ticket) => ({
            id: ticket.id.toString(),
            label: `#${ticket.id}`,
            description: (
              <div className={classes.cardBody}>
                <p className={classes.cardPhone}>{ticket.contact.number}</p>
                {ticket.lastMessage && (
                  <p className={classes.cardMsg}>{ticket.lastMessage}</p>
                )}
                <button
                  type="button"
                  className={classes.button}
                  onClick={() => handleCardClick(ticket.uuid)}
                >
                  Ver Ticket
                </button>
              </div>
            ),
            title: ticket.contact.name,
            draggable: true,
            href: "/tickets/" + ticket.uuid,
          })),
          style: {
            borderTop: `3px solid ${tag.color || "var(--action)"}`,
          },
        };
      }),
    ];

    setFile({ lanes });
  };

  useEffect(() => {
    popularCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags, tickets, reloadData]);

  const handleCardMove = async (cardId, sourceLaneId, targetLaneId) => {
    try {
      await api.delete(`/ticket-tags/${targetLaneId}`);
      toast.success("Ticket Tag Removido!");
      await api.put(`/ticket-tags/${targetLaneId}/${sourceLaneId}`);
      toast.success("Ticket Tag Adicionado com Sucesso!");
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>Kanban de Atendimentos</Title>
      </MainHeader>
      <div className={`${classes.boardWrapper} portai-kanban-board`}>
        <Board
          data={file}
          onCardMoveAcrossLanes={handleCardMove}
          style={{ backgroundColor: "transparent" }}
        />
      </div>
    </MainContainer>
  );
};

export default Kanban;
