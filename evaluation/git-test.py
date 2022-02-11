#!/usr/bin/env python3
import sys
from mitmproxy import io, http

[_, filename] = sys.argv
flows = []

with open(filename, 'rb') as logfile:
    freader = io.FlowReader(logfile)
    for flow in freader.stream():
        if isinstance(flow, http.HTTPFlow):
            flows.append(flow)

total = 0
for flow in flows:
    req_len = len(flow.request.content)
    resp_len = len(flow.response.content)
    print(f"request: {req_len} bytes, response: {resp_len} bytes {flow.request}")
    total += req_len + resp_len

# The first request on `git push` is rejected by the server with status 401 and
# message "No anonymous write access". We don't count that request towards the
# number of round trips.
round_trips = len([f for f in flows if f.response.status_code == 200])
print(f"Total: {total / 1000} kB, {round_trips} round trips")
