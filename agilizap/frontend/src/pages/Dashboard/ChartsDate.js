import React, { useEffect, useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import brLocale from 'date-fns/locale/pt-BR';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { Button, Stack, TextField } from '@mui/material';
import Typography from "@material-ui/core/Typography";
import api from '../../services/api';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export const options = {
    responsive: true,
    plugins: {
        legend: {
            position: 'top',
            display: false,
        },
        title: {
            display: false,
        },
        datalabels: {
            display: false,
        },
    },
    scales: {
        x: {
            grid: {
                display: false,
            },
        },
        y: {
            grid: {
                color: 'rgba(148, 163, 184, 0.1)',
            },
        },
    },
};

export const ChartsDate = () => {
    const [initialDate, setInitialDate] = useState(new Date());
    const [finalDate, setFinalDate] = useState(new Date());
    const [ticketsData, setTicketsData] = useState({ data: [], count: 0 });

    const companyId = localStorage.getItem("companyId");

    useEffect(() => {
        handleGetTicketsInformation();
    }, []);

    const dataCharts = {
        labels: ticketsData && ticketsData?.data.length > 0 && ticketsData?.data.map((item) => (item.hasOwnProperty('horario') ? `Das ${item.horario}:00 às ${item.horario}:59` : item.data)),
        datasets: [
            {
                data: ticketsData?.data.length > 0 && ticketsData?.data.map((item) => item.total),
                backgroundColor: '#10b981',
                borderRadius: 6,
            },
        ],
    };

    const handleGetTicketsInformation = async () => {
        try {
            const { data } = await api.get(`/dashboard/ticketsDay?initialDate=${format(initialDate, 'yyyy-MM-dd')}&finalDate=${format(finalDate, 'yyyy-MM-dd')}&companyId=${companyId}`);
            setTicketsData(data);
        } catch (error) {
            toast.error('Erro ao buscar informações dos tickets');
        }
    };

    return (
        <>
            <Typography
                component="h2"
                style={{
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                    marginBottom: 16,
                }}
            >
                Total de Atendimentos por Período ({ticketsData?.count || 0})
            </Typography>

            <Stack direction={'row'} spacing={2} alignItems={'center'} sx={{ mb: 2.5 }} flexWrap="wrap" gap={1}>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={brLocale}>
                    <DatePicker
                        value={initialDate}
                        onChange={(newValue) => { setInitialDate(newValue) }}
                        label="Início"
                        renderInput={(params) => <TextField size="small" {...params} sx={{ width: '18ch' }} />}
                    />
                </LocalizationProvider>

                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={brLocale}>
                    <DatePicker
                        value={finalDate}
                        onChange={(newValue) => { setFinalDate(newValue) }}
                        label="Fim"
                        renderInput={(params) => <TextField size="small" {...params} sx={{ width: '18ch' }} />}
                    />
                </LocalizationProvider>

                <Button
                    onClick={handleGetTicketsInformation}
                    variant='contained'
                    sx={{
                        backgroundColor: "#10b981",
                        "&:hover": { backgroundColor: "#059669" },
                        textTransform: "none",
                        borderRadius: "10px",
                        fontWeight: 700,
                        boxShadow: "none",
                        height: 40,
                        px: 2.5,
                    }}
                >
                    Filtrar
                </Button>
            </Stack>

            <Bar options={options} data={dataCharts} style={{ maxWidth: '100%', maxHeight: '280px' }} />
        </>
    );
};