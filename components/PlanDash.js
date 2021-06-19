import { Button, Grid, Paper } from '@material-ui/core';
import axios from 'axios';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';

import { INSTRUMENT_DETAILS, STRATEGIES_DETAILS } from '../lib/constants';
import TradeDetails from './lib/tradeDetails';

const PlanDash = () => {
  const [plans, setPlans] = useState({});
  const { data: tradesDay, error } = useSWR('/api/trades_day');
  // const dayOfWeek = dayjs().format('dddd').toLowerCase();
  const dayOfWeek = 'monday';

  useEffect(() => {
    async function fn() {
      const { data } = await axios('/api/plan');
      const date = dayjs();
      const day = date.format('D');
      const month = Number(date.format('M')) - 1;
      const year = date.format('YYYY');
      const dayWiseData = data.reduce((accum, config) => {
        const updatedConfig = { ...config };
        if (updatedConfig.runAt) {
          updatedConfig.runAt = dayjs(updatedConfig.runAt)
            .set('date', day)
            .set('month', month)
            .set('year', year)
            .format();
        }

        if (updatedConfig.squareOffTime) {
          updatedConfig.squareOffTime = dayjs(updatedConfig.squareOffTime)
            .set('date', day)
            .set('month', month)
            .set('year', year)
            .format();
        }

        if (Array.isArray(accum[updatedConfig._collection])) {
          return {
            ...accum,
            [updatedConfig._collection]: [...accum[updatedConfig._collection], updatedConfig]
          };
        }
        return {
          ...accum,
          [updatedConfig._collection]: [updatedConfig]
        };
      }, {});

      setPlans(dayWiseData);
    }

    fn();
  }, []);

  async function handleScheduleJob(plan) {
    const { runAt } = plan;
    const runNow = dayjs().isAfter(dayjs(runAt));
    await axios.post('/api/trades_day', {
      ...plan,
      plan_ref: plan._id,
      runNow
    });
    mutate('/api/trades_day');
  }

  const enableAllSchedule = plans[dayOfWeek]?.every((plan) => dayjs().isBefore(dayjs(plan.runAt)));

  async function handleScheduleEverything() {
    await Promise.all(plans[dayOfWeek].map(handleScheduleJob));
    mutate('/api/trades_day');
  }

  const pendingTrades = plans[dayOfWeek]?.filter(
    (plan) => !tradesDay?.find((trade) => trade.plan_ref === plan._id)
  );

  if (!pendingTrades?.length) {
    return null;
  }

  return (
    <div>
      <h3>Pending trades as per plan</h3>
      {plans[dayOfWeek] && enableAllSchedule ? (
        <Button
          style={{ marginBottom: 18 }}
          variant="contained"
          color="primary"
          type="button"
          onClick={handleScheduleEverything}>
          Schedule all trades
        </Button>
      ) : null}
      {pendingTrades.map((plan, idx) => {
        return (
          <div key={plan._id}>
            <Paper style={{ padding: 16, marginBottom: 32 }}>
              <h4>
                {idx + 1} · {STRATEGIES_DETAILS[plan.strategy].heading}
              </h4>

              <h2>{INSTRUMENT_DETAILS[plan.instrument].displayName}</h2>

              <TradeDetails strategy={plan.strategy} tradeDetails={plan} />

              <Grid item style={{ marginTop: 16 }}>
                <Button variant="contained" type="button" onClick={() => handleScheduleJob(plan)}>
                  {dayjs().isBefore(dayjs(plan.runAt))
                    ? `Schedule for ${dayjs(plan.runAt).format('hh:mm a')}`
                    : `Run now`}
                </Button>
              </Grid>
            </Paper>
          </div>
        );
      })}
    </div>
  );
};

export default PlanDash;
