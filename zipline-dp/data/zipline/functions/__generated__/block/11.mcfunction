#built using mc-build (https://github.com/mc-build/mc-build)

tellraw @p {"text":"Off hand must be empty to use!","bold":true,"color":"red"}
playsound block.note_block.guitar master @a ~ ~ ~ .5 .5
scoreboard players reset @s lub.rightclick