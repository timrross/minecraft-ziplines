#built using mc-build (https://github.com/mc-build/mc-build)

execute as @e[type=marker,tag=front_zipline] at @s run function zipline:zip_line_wire
schedule function zipline:tick_5t 5t