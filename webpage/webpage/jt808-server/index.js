const net = require('net');
const { createClient } = require('@supabase/supabase-js');

const PORT = Number(process.env.PORT || 8808);
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

function log(message, extra = {}) {
  const payload = Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : '';
  console.log(`[jt808] ${new Date().toISOString()} ${message}${payload}`);
}

function toHex(buffer) {
  return buffer.toString('hex').toUpperCase();
}

function bcdToString(buffer) {
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeTerminalPhone(buffer) {
  const bcd = bcdToString(buffer);
  const normalized = bcd.replace(/^0+/, '');
  return normalized || '0';
}

function parseBcdDateToIsoUtc(buffer) {
  const value = bcdToString(buffer);
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  const hour = Number(value.slice(6, 8));
  const minute = Number(value.slice(8, 10));
  const second = Number(value.slice(10, 12));

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
}

function computeChecksum(buffer) {
  let checksum = 0;
  for (const byte of buffer) {
    checksum ^= byte;
  }
  return checksum;
}

function escapeMessage(buffer) {
  const escaped = [];
  for (const byte of buffer) {
    if (byte === 0x7e) {
      escaped.push(0x7d, 0x02);
    } else if (byte === 0x7d) {
      escaped.push(0x7d, 0x01);
    } else {
      escaped.push(byte);
    }
  }
  return Buffer.from(escaped);
}

function unescapeMessage(buffer) {
  const unescaped = [];
  for (let index = 0; index < buffer.length; index += 1) {
    const byte = buffer[index];
    if (byte === 0x7d) {
      const next = buffer[index + 1];
      if (next === 0x02) {
        unescaped.push(0x7e);
        index += 1;
      } else if (next === 0x01) {
        unescaped.push(0x7d);
        index += 1;
      } else {
        throw new Error(`Invalid escape sequence: 0x7D 0x${(next ?? 0).toString(16).padStart(2, '0')}`);
      }
    } else {
      unescaped.push(byte);
    }
  }
  return Buffer.from(unescaped);
}

function parseMessageHeader(buffer) {
  if (buffer.length < 12) {
    throw new Error(`JT808 header too short: ${buffer.length}`);
  }

  const messageId = buffer.readUInt16BE(0);
  const bodyProps = buffer.readUInt16BE(2);
  const bodyLength = bodyProps & 0x03ff;
  const terminalPhoneRaw = buffer.subarray(4, 10);
  const terminalPhone = decodeTerminalPhone(terminalPhoneRaw);
  const flowId = buffer.readUInt16BE(10);
  const headerLength = 12;
  const body = buffer.subarray(headerLength, headerLength + bodyLength);

  if (body.length !== bodyLength) {
    throw new Error(`JT808 body length mismatch: expected ${bodyLength}, got ${body.length}`);
  }

  return {
    messageId,
    bodyProps,
    bodyLength,
    terminalPhone,
    terminalPhoneRaw,
    flowId,
    headerLength,
    body,
  };
}

function parseLocationReport(body) {
  if (body.length < 28) {
    throw new Error(`0x0200 body too short: ${body.length}`);
  }

  const alarmFlag = body.readUInt32BE(0);
  const statusFlag = body.readUInt32BE(4);
  let latitude = body.readUInt32BE(8) / 1e6;
  let longitude = body.readUInt32BE(12) / 1e6;
  const altitude = body.readUInt16BE(16);
  const speed = body.readUInt16BE(18) / 10;
  const direction = body.readUInt16BE(20);
  const gpsTime = parseBcdDateToIsoUtc(body.subarray(22, 28));

  // 按需求使用状态位判断南纬/西经：bit2=0 南纬，bit1=0 西经。
  if ((statusFlag & 0x04) === 0) {
    latitude *= -1;
  }

  if ((statusFlag & 0x02) === 0) {
    longitude *= -1;
  }

  return {
    alarmFlag,
    statusFlag,
    latitude,
    longitude,
    altitude,
    speed,
    direction,
    gpsTime,
  };
}

function encodeTerminalPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '').padStart(12, '0').slice(-12);
  return Buffer.from(digits, 'hex');
}

function buildGeneralAck({ terminalPhone, flowId, originalMessageId, result = 0 }) {
  const body = Buffer.alloc(5);
  body.writeUInt16BE(flowId, 0);
  body.writeUInt16BE(originalMessageId, 2);
  body.writeUInt8(result, 4);

  const header = Buffer.alloc(12);
  header.writeUInt16BE(0x8001, 0);
  header.writeUInt16BE(body.length, 2);
  encodeTerminalPhone(terminalPhone).copy(header, 4);
  header.writeUInt16BE(flowId, 10);

  const packet = Buffer.concat([header, body]);
  const checksum = computeChecksum(packet);
  return Buffer.concat([Buffer.from([0x7e]), escapeMessage(Buffer.concat([packet, Buffer.from([checksum])])), Buffer.from([0x7e])]);
}

function extractFrames(buffer) {
  const frames = [];
  let working = buffer;

  while (working.length > 0) {
    const start = working.indexOf(0x7e);
    if (start === -1) {
      return { frames, remainder: Buffer.alloc(0) };
    }

    if (start > 0) {
      working = working.subarray(start);
    }

    const end = working.indexOf(0x7e, 1);
    if (end === -1) {
      return { frames, remainder: working };
    }

    const frame = working.subarray(1, end);
    if (frame.length > 0) {
      frames.push(frame);
    }
    working = working.subarray(end + 1);
  }

  return { frames, remainder: Buffer.alloc(0) };
}

async function insertVehicleLocation(message) {
  if (!supabase) {
    log('Supabase env is missing, skip vehicle location insert');
    return;
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id')
    .eq('terminal_phone', message.terminalPhone)
    .eq('is_active', true)
    .maybeSingle();

  if (vehicleError) {
    throw vehicleError;
  }

  if (!vehicle) {
    log('Vehicle not found for terminal phone', {
      terminalPhone: message.terminalPhone,
      flowId: message.flowId,
    });
    return;
  }

  const { error: insertError } = await supabase.from('vehicle_locations').insert({
    vehicle_id: vehicle.id,
    terminal_phone: message.terminalPhone,
    latitude: message.location.latitude,
    longitude: message.location.longitude,
    speed: message.location.speed,
    direction: message.location.direction,
    altitude: message.location.altitude,
    gps_time: message.location.gpsTime,
    alarm_flag: String(message.location.alarmFlag),
    status_flag: String(message.location.statusFlag),
  });

  if (insertError) {
    throw insertError;
  }

  log('Vehicle location inserted', {
    vehicleId: vehicle.id,
    terminalPhone: message.terminalPhone,
    latitude: message.location.latitude,
    longitude: message.location.longitude,
    gpsTime: message.location.gpsTime,
  });
}

async function processFrame(socket, frame) {
  const payload = unescapeMessage(frame);
  if (payload.length < 13) {
    throw new Error(`JT808 frame too short: ${payload.length}`);
  }

  const checksum = payload[payload.length - 1];
  const content = payload.subarray(0, payload.length - 1);
  const expectedChecksum = computeChecksum(content);
  if (checksum !== expectedChecksum) {
    throw new Error(`JT808 checksum mismatch: expected ${expectedChecksum}, got ${checksum}`);
  }

  const header = parseMessageHeader(content);
  const message = {
    ...header,
    raw: content,
  };

  log('Parsed JT808 message', {
    messageId: `0x${header.messageId.toString(16).padStart(4, '0')}`,
    terminalPhone: header.terminalPhone,
    flowId: header.flowId,
    bodyLength: header.bodyLength,
  });

  if (header.messageId === 0x0200) {
    message.location = parseLocationReport(header.body);
    await insertVehicleLocation(message);
  }

  const ack = buildGeneralAck({
    terminalPhone: header.terminalPhone,
    flowId: header.flowId,
    originalMessageId: header.messageId,
    result: 0,
  });
  socket.write(ack);

  log('Sent general ack', {
    ackMessageId: '0x8001',
    originalMessageId: `0x${header.messageId.toString(16).padStart(4, '0')}`,
    flowId: header.flowId,
    ackHex: toHex(ack),
  });
}

async function verifySupabaseConnection() {
  if (!supabase) {
    log('Supabase env is missing, skip connectivity check');
    return;
  }

  const { error } = await supabase.from('vehicles').select('id', { count: 'exact', head: true });
  if (error) {
    log('Supabase connectivity check failed', { message: error.message });
    return;
  }

  log('Supabase connectivity check passed');
}

async function handleMessage(socket, buffer) {
  log('Received TCP payload', {
    remoteAddress: socket.remoteAddress,
    remotePort: socket.remotePort,
    size: buffer.length,
    hexPreview: buffer.subarray(0, 32).toString('hex'),
  });

  socket._jt808Buffer = socket._jt808Buffer
    ? Buffer.concat([socket._jt808Buffer, buffer])
    : Buffer.from(buffer);

  const { frames, remainder } = extractFrames(socket._jt808Buffer);
  socket._jt808Buffer = remainder;

  for (const frame of frames) {
    try {
      await processFrame(socket, frame);
    } catch (error) {
      log('Failed to process JT808 frame', {
        message: error instanceof Error ? error.message : String(error),
        frameHex: toHex(frame),
      });
    }
  }
}

const server = net.createServer((socket) => {
  socket._jt808Buffer = Buffer.alloc(0);

  log('Client connected', {
    remoteAddress: socket.remoteAddress,
    remotePort: socket.remotePort,
  });

  socket.on('data', async (buffer) => {
    try {
      await handleMessage(socket, buffer);
    } catch (error) {
      log('Failed to process TCP payload', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  socket.on('error', (error) => {
    log('Socket error', {
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
      message: error.message,
    });
  });

  socket.on('close', () => {
    log('Client disconnected', {
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
    });
  });
});

server.on('error', (error) => {
  log('TCP server error', {
    message: error.message,
  });
  process.exitCode = 1;
});

async function start() {
  await verifySupabaseConnection();

  server.listen(PORT, '0.0.0.0', () => {
    log('JT808 TCP server started', { port: PORT });
  });
}

function shutdown(signal) {
  log(`Received ${signal}, shutting down`);
  server.close(() => {
    log('JT808 TCP server stopped');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  log('Failed to start JT808 TCP server', {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
