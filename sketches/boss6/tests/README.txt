Boss 6 (King Bob's rematch) test scripts, as Boss 5's in sketches/fishing. Serve a build first
(PORT=8411 node ./server.mjs) and run from the repo root; pictures go to shots/boss6/.
  tplay.cjs <port> <light 0|1> win|lose <tag> [account]  the whole contest played through (a tester account: founder / neil)
  tending.cjs <port> <light> <tag> [lose]               straight to the ending (or King Bob's win)
  tpart6.cjs <port> <light> win|lose                     Part 6's goal into Boss 6, then the results / back to Part 6
  tgate.cjs <port>                                       who sees Boss 6 (Part 6's testers only)
  tmoments.cjs <port> <light>                            a picture of each moment, intro to results
  tintro.cjs <port> <light> <tag> [seconds]              a frame a second from the start
  tprobe.cjs <port> <light>                              which storm layers cost what (frame gaps at 4x, SHOT=boat or out on the line)
