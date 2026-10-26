import click
import uvicorn


@click.group()
def cli() -> None:
    pass


@cli.command()
def webserver() -> None:
    uvicorn.run("lv_backend.presentation.app:app", host="0.0.0.0", port=8000, reload=True)
